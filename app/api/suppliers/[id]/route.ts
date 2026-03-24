import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      purchases: { orderBy: { date: 'desc' } },
      payments: { orderBy: { date: 'desc' } },
    },
  });
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const totalPurchased = await prisma.purchase.aggregate({
    where: { supplierId: params.id },
    _sum: { total: true },
  });
  const totalPaid = await prisma.payment.aggregate({
    where: { supplierId: params.id, type: 'PAID' },
    _sum: { amount: true },
  });

  return NextResponse.json({
    ...supplier,
    totalPurchased: totalPurchased._sum.total ?? 0,
    totalPaid: totalPaid._sum.amount ?? 0,
    balance: (totalPurchased._sum.total ?? 0) - (totalPaid._sum.amount ?? 0),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
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
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  await prisma.supplier.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
