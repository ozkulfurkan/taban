import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const [customer, cekler] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: params.id, companyId: user.companyId },
      include: {
        invoices: {
          orderBy: { date: 'desc' },
          include: {
            items: true,
            createdBy: { select: { name: true } },
          },
        },
        payments: { orderBy: { date: 'desc' }, select: { amount: true, method: true, notes: true, id: true, date: true, currency: true } },
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

  const totalNormalInvoiced = salesInvoices.reduce((s: number, i: any) => s + i.total, 0);
  const totalReturnInvoiced = returnInvoices.reduce((s: number, i: any) => s + i.total, 0);

  let balanceDelta = 0;
  let totalPaid = 0;
  for (const p of customer.payments) {
    if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
      balanceDelta += p.amount;
    } else {
      balanceDelta -= p.amount;
      totalPaid += p.amount;
    }
  }

  // Çekler bakiyeye dahil: customerAmount (çapraz döviz) veya tutar (aynı döviz)
  let totalCek = 0;
  for (const c of cekler) {
    const amt = c.customerAmount ?? c.tutar;
    totalCek += amt;
    balanceDelta -= amt;
    totalPaid += amt;
  }

  const balance = totalNormalInvoiced - totalReturnInvoiced + balanceDelta;

  return NextResponse.json({
    ...customer,
    invoices: salesInvoices,
    returns: returnInvoices,
    totalInvoiced: totalNormalInvoiced,
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
  return NextResponse.json(customer);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  await prisma.customer.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
