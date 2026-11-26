import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { supplierBalance } from '@/lib/money';
import { logAction, getIp } from '@/lib/audit-logger';
import { partyInputError } from '@/lib/party-input';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      purchases: {
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          purchaseMaterials: {
            include: { material: { select: { id: true, name: true } }, product: { select: { id: true, name: true, code: true } } },
          },
        },
      },
      payments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], select: { amount: true, method: true, notes: true, id: true, date: true, currency: true, accountId: true, originalAmount: true, originalCurrency: true, exchangeRate: true, invoiceId: true, purchaseId: true } },
    },
  });
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Net alış (iadeler düşülür) − ödemeler (+ borç fişleri)
  const { totalPurchased, totalPaid, balance } = supplierBalance(supplier.purchases as any, supplier.payments as any);

  return NextResponse.json({
    ...supplier,
    totalPurchased,
    totalPaid,
    balance,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const inputError = partyInputError(body, { requireName: false });
  if (inputError) return NextResponse.json({ error: inputError }, { status: 400 });
  try {
    await prisma.supplier.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: {
        name: body.name,
        taxId: body.taxId || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        notes: body.notes || null,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'UPDATE',
      entity: 'Supplier',
      entityId: params.id,
      detail: `Tedarikçi güncellendi — ${body.name}`,
      ip: getIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Supplier',
      entityId: params.id,
      detail: `Tedarikçi güncellenemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      meta: { input: { name: body.name } },
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Tedarikçi güncellenemedi' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { name: true },
    });
    if (!supplier) return NextResponse.json({ error: 'Tedarikçi bulunamadı' }, { status: 404 });
    await (prisma as any).supplier.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: { status: 1 },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'DELETE',
      entity: 'Supplier',
      entityId: params.id,
      detail: `Tedarikçi silindi (soft) — ${supplier.name}`,
      ip: getIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Supplier',
      entityId: params.id,
      detail: `Tedarikçi silinemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Tedarikçi silinemedi' }, { status: 500 });
  }
}
