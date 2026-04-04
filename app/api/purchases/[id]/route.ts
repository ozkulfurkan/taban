import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true, taxId: true } },
      payments: { orderBy: { date: 'desc' } },
    },
  });

  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(purchase);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { invoiceNo, date, currency, notes } = body;

  const updated = await prisma.purchase.updateMany({
    where: { id: params.id, companyId: user.companyId },
    data: {
      ...(invoiceNo !== undefined && { invoiceNo }),
      ...(date && { date: new Date(date) }),
      ...(currency && { currency }),
      ...(notes !== undefined && { notes }),
    },
  });

  if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true, taxId: true } },
      payments: { orderBy: { date: 'desc' } },
    },
  });

  return NextResponse.json(purchase);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      payments: true,
      purchaseMaterials: true,
    },
  });

  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // ── Stok geri al: alışta eklenen kg'ları düş ──
    for (const pm of (purchase as any).purchaseMaterials) {
      if (pm.materialVariantId) {
        await tx.materialVariant.updateMany({
          where: { id: pm.materialVariantId },
          data: { stock: { decrement: pm.kgAmount } },
        });
      } else if (pm.materialId) {
        await tx.material.updateMany({
          where: { id: pm.materialId, companyId: user.companyId },
          data: { stock: { decrement: pm.kgAmount } },
        });
      }
    }

    // Reverse account balances for all payments
    for (const payment of purchase.payments) {
      if (payment.accountId) {
        const reversalAmount = (payment as any).originalAmount ?? payment.amount;
        await tx.account.update({
          where: { id: payment.accountId },
          data: { balance: { increment: reversalAmount } }, // paid → reverse = add back
        });
      }
      // Return Çek to PORTFOY if applicable
      if (payment.method === 'Çek') {
        const cekWhereClause: any = {
          companyId: user.companyId,
          tutar: payment.amount,
          durum: 'TEDARIKCI_VERILDI',
        };
        if (payment.notes) cekWhereClause.seriNo = { contains: payment.notes };
        await tx.cek.updateMany({
          where: cekWhereClause,
          data: { durum: 'PORTFOY', supplierId: null },
        });
      }
    }
    await tx.purchaseMaterial.deleteMany({ where: { purchaseId: params.id } });
    await tx.payment.deleteMany({ where: { purchaseId: params.id } });
    await tx.purchase.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ success: true });
}
