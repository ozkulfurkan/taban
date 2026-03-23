import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      invoices: { orderBy: { date: 'desc' } },
      payments: { orderBy: { date: 'desc' } },
    },
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const totalInvoiced = await prisma.invoice.aggregate({
    where: { customerId: params.id },
    _sum: { total: true },
  });
  const totalPaid = await prisma.payment.aggregate({
    where: { customerId: params.id, type: 'RECEIVED' },
    _sum: { amount: true },
  });

  return NextResponse.json({
    ...customer,
    totalInvoiced: totalInvoiced._sum.total ?? 0,
    totalPaid: totalPaid._sum.amount ?? 0,
    balance: (totalInvoiced._sum.total ?? 0) - (totalPaid._sum.amount ?? 0),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const customer = await prisma.customer.updateMany({
    where: { id: params.id, companyId: user.companyId },
    data: {
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

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  await prisma.customer.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
