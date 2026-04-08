import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ customers: [], total: 0, page: 1, totalPages: 0 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const search = searchParams.get('search')?.trim() ?? '';

  const where: any = { companyId: user.companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.customer.count({ where }),
  ]);

  const ids = customers.map(c => c.id);

  // Batch: tüm fatura + ödemeleri 2 sorguda çek (N+1 yerine)
  const [allInvoices, allPayments] = ids.length > 0
    ? await Promise.all([
        prisma.invoice.findMany({
          where: { customerId: { in: ids } },
          select: { customerId: true, total: true, isReturn: true },
        }),
        prisma.payment.findMany({
          where: { customerId: { in: ids }, type: 'RECEIVED' },
          select: { customerId: true, amount: true, method: true, notes: true },
        }),
      ])
    : [[], []];

  // Group by customerId
  const invoiceMap = new Map<string, typeof allInvoices>();
  for (const inv of allInvoices) {
    const list = invoiceMap.get(inv.customerId) ?? [];
    list.push(inv);
    invoiceMap.set(inv.customerId, list);
  }
  const paymentMap = new Map<string, typeof allPayments>();
  for (const pmt of allPayments) {
    const list = paymentMap.get(pmt.customerId) ?? [];
    list.push(pmt);
    paymentMap.set(pmt.customerId, list);
  }

  const result = customers.map(c => {
    const invoices = invoiceMap.get(c.id) ?? [];
    const payments = paymentMap.get(c.id) ?? [];

    const totalNormal = invoices.filter(i => !i.isReturn).reduce((s, i) => s + i.total, 0);
    const totalReturn = invoices.filter(i => i.isReturn).reduce((s, i) => s + i.total, 0);

    let balanceDelta = 0;
    let totalPaid = 0;
    for (const p of payments) {
      if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
        balanceDelta += p.amount;
      } else {
        balanceDelta -= p.amount;
        totalPaid += p.amount;
      }
    }
    const balance = totalNormal - totalReturn + balanceDelta;

    return { ...c, totalInvoiced: totalNormal, totalPaid, balance };
  });

  return NextResponse.json({
    customers: result,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const customer = await prisma.customer.create({
    data: {
      companyId: user.companyId,
      name: body.name,
      taxId: body.taxId || null,
      taxOffice: body.taxOffice || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      currency: body.currency || 'TRY',
      notes: body.notes || null,
    },
  });
  return NextResponse.json(customer);
}
