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
      payments: { orderBy: { date: 'desc' }, select: { amount: true, method: true, notes: true, id: true, date: true, currency: true } },
    },
  });
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const totalPurchased = supplier.purchases.reduce((s: number, p: any) => s + p.total, 0);

  let balanceDelta = 0;
  let totalPaid = 0;
  for (const p of supplier.payments) {
    if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
      balanceDelta += p.amount;
    } else {
      balanceDelta -= p.amount;
      totalPaid += p.amount;
    }
  }

  const balance = totalPurchased + balanceDelta;

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
