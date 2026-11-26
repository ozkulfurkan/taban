import { NextRequest, NextResponse } from 'next/server';
import { supplierBalanceOf } from '@/lib/party-balance';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInput } from '@/lib/time';
import { rejectForeignRefs } from '@/lib/tenant';
import { logAction, getIp } from '@/lib/audit-logger';
import { validatePurchaseLines, applyPurchaseLines, reversePurchaseLines, purchaseStatus } from '@/lib/purchase-lines';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true, taxId: true } },
      payments: { orderBy: { date: 'desc' } },
      purchaseMaterials: {
        orderBy: { createdAt: 'asc' },
        include: {
          material: { select: { id: true, name: true, stock: true } },
          product: { select: { id: true, name: true, code: true, unit: true, stock: true } },
        },
      },
    },
  });

  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Ödemeler alışa değil tedarikçinin carisine işlenir: ekranda güncel bakiye gösterilir
  const supplierBalance = purchase.supplierId ? await supplierBalanceOf(user.companyId, purchase.supplierId) : null;
  return NextResponse.json({ ...purchase, supplierBalance });
}

// Alış düzenleme. items gönderilirse kalemler tamamen değişir: eski kalemlerin
// stok etkisi geri alınır, yenileri uygulanır, toplam ve ödeme durumu yeniden hesaplanır.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const existing = await prisma.purchase.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { invoiceNo, date, notes, items } = body;

  let validated: Extract<ReturnType<typeof validatePurchaseLines>, { ok: true }> | null = null;
  if (items !== undefined) {
    const foreign = await rejectForeignRefs(user.companyId, {
      product: Array.isArray(items) ? items.map((i: any) => i?.productId) : [],
      material: Array.isArray(items) ? items.map((i: any) => i?.materialId) : [],
      subcontractor: Array.isArray(items) ? items.map((i: any) => i?.subcontractorId) : [],
    });
    if (foreign) return foreign;
    const v = validatePurchaseLines(items);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    validated = v;
  }

  let newDate: Date | undefined;
  if (date) {
    const d = parseDateInput(date);
    if (!d) return NextResponse.json({ error: 'Alış tarihi geçersiz' }, { status: 400 });
    newDate = d;
  }
  const newNo = typeof invoiceNo === 'string' && invoiceNo.trim() ? invoiceNo.trim() : undefined;
  if (newNo && newNo !== existing.invoiceNo && await prisma.purchase.findFirst({ where: { companyId: user.companyId, invoiceNo: newNo }, select: { id: true } })) {
    return NextResponse.json({ error: `${newNo} numaralı alış zaten var` }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    if (validated) {
      const dir = existing.isReturn ? -1 : 1;
      await reversePurchaseLines(tx, user.companyId, existing.id, dir);
      await applyPurchaseLines(tx, user.companyId, existing.id, validated.lines, dir);
    }
    await tx.purchase.update({
      where: { id: existing.id },
      data: {
        ...(newNo !== undefined && { invoiceNo: newNo }),
        ...(newDate && { date: newDate }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(validated && { total: validated.total, status: purchaseStatus(existing.paidAmount, validated.total) as any }),
      },
    });
  });

  if (validated) {
    await logAction({
      companyId: user.companyId, userId: user.id, userName: user.name,
      action: 'UPDATE', entity: 'Purchase', entityId: existing.id,
      detail: `${existing.isReturn ? 'Alış iadesi' : 'Alış'} düzenlendi — ${newNo ?? existing.invoiceNo ?? existing.id}`,
      meta: { oldTotal: existing.total, total: validated.total, currency: existing.currency },
      ip: getIp(req),
    });
  }

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
    },
  });

  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // Stok geri al (ürün, ana depo ve fasoncu deposu) ve kalemleri sil
    await reversePurchaseLines(tx, user.companyId, params.id, purchase.isReturn ? -1 : 1);

    // Ödemeler alışa değil tedarikçinin carisine aittir: silinmez, caride kalır (eski kayıtlardaki bağ kaldırılır)
    await tx.payment.updateMany({ where: { purchaseId: params.id }, data: { purchaseId: null } });
    await tx.purchase.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ success: true });
}
