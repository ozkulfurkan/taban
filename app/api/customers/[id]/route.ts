import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';
import { customerBalance } from '@/lib/money';
import { partyInputError } from '@/lib/party-input';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const [customer, cekler] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        invoices: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
            items: { include: { product: { select: { code: true } } } },
            createdBy: { select: { name: true } },
          },
        },
        payments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], select: { amount: true, method: true, notes: true, id: true, date: true, currency: true } },
      },
    }),
    prisma.cek.findMany({
      where: { customerId: params.id, companyId: user.companyId, islem: 'Müşteriden Alınan Çek Kaydı' },
      orderBy: { islemTarihi: 'desc' },
    }),
  ]);
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const salesInvoices = customer.invoices.filter((inv: any) => !inv.isReturn);
  const returnInvoices = customer.invoices.filter((inv: any) => inv.isReturn);

  const { totalInvoiced, totalPaid, totalCek, balance } = customerBalance(customer.invoices as any, customer.payments as any, cekler as any);

  return NextResponse.json({
    ...customer,
    invoices: salesInvoices,
    returns: returnInvoices,
    totalInvoiced,
    totalPaid,
    totalCek,
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
    // currency değiştirilmesine izin verme — oluşturulurken belirlenir, sonradan değişmez
    const customer = await prisma.customer.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: {
        name: body.name,
        taxId: body.taxId || null,
        taxOffice: body.taxOffice || null,
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
      entity: 'Customer',
      entityId: params.id,
      detail: `Müşteri güncellendi — ${body.name}`,
      ip: getIp(req),
    });
    return NextResponse.json(customer);
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Customer',
      entityId: params.id,
      detail: `Müşteri güncellenemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      meta: { input: { name: body.name } },
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Müşteri güncellenemedi' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, companyId: user.companyId },
      select: { name: true },
    });
    if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

    await (prisma as any).customer.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: { status: 1 },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'DELETE',
      entity: 'Customer',
      entityId: params.id,
      detail: `Müşteri silindi (soft) — ${customer.name}`,
      ip: getIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Customer',
      entityId: params.id,
      detail: `Müşteri silinemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Müşteri silinemedi' }, { status: 500 });
  }
}
