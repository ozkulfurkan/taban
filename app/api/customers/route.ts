import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    include: {
      _count: { select: { invoices: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Cari bakiye hesapla (detay sayfasıyla aynı mantık)
  const result = await Promise.all(customers.map(async (c) => {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId: c.id },
        select: { total: true, isReturn: true },
      }),
      prisma.payment.findMany({
        where: { customerId: c.id, type: 'RECEIVED' },
        select: { amount: true, method: true, notes: true },
      }),
    ]);

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

    return {
      ...c,
      totalInvoiced: totalNormal,
      totalPaid,
      balance,
    };
  }));

  return NextResponse.json(result);
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
