import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const suppliers = await prisma.supplier.findMany({
    where: { companyId: user.companyId },
    include: { _count: { select: { purchases: true } } },
    orderBy: { name: 'asc' },
  });

  const result = await Promise.all(suppliers.map(async (s) => {
    const totalPurchased = await prisma.purchase.aggregate({
      where: { supplierId: s.id },
      _sum: { total: true },
    });
    const totalPaid = await prisma.payment.aggregate({
      where: { supplierId: s.id, type: 'PAID' },
      _sum: { amount: true },
    });
    return {
      ...s,
      totalPurchased: totalPurchased._sum.total ?? 0,
      totalPaid: totalPaid._sum.amount ?? 0,
      balance: (totalPurchased._sum.total ?? 0) - (totalPaid._sum.amount ?? 0),
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
  const supplier = await prisma.supplier.create({
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
  return NextResponse.json(supplier);
}
