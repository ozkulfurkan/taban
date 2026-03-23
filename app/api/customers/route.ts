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

  // Cari bakiye hesapla
  const result = await Promise.all(customers.map(async (c) => {
    const totalInvoiced = await prisma.invoice.aggregate({
      where: { customerId: c.id },
      _sum: { total: true },
    });
    const totalPaid = await prisma.payment.aggregate({
      where: { customerId: c.id, type: 'RECEIVED' },
      _sum: { amount: true },
    });
    return {
      ...c,
      totalInvoiced: totalInvoiced._sum.total ?? 0,
      totalPaid: totalPaid._sum.amount ?? 0,
      balance: (totalInvoiced._sum.total ?? 0) - (totalPaid._sum.amount ?? 0),
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
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(customer);
}
