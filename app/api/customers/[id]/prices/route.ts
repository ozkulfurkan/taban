import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prices = await prisma.customerProductPrice.findMany({
    where: { customerId: params.id, companyId: user.companyId },
    include: { product: { select: { id: true, name: true, code: true, unit: true, unitPrice: true, currency: true } } },
    orderBy: { product: { name: 'asc' } },
  });

  return NextResponse.json(prices);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, unitPrice, currency } = await req.json();
  if (!productId || unitPrice == null) return NextResponse.json({ error: 'Eksik alan' }, { status: 400 });

  const price = await prisma.customerProductPrice.upsert({
    where: { customerId_productId: { customerId: params.id, productId } },
    update: { unitPrice: Number(unitPrice), currency: currency ?? 'TRY' },
    create: {
      customerId: params.id,
      productId,
      unitPrice: Number(unitPrice),
      currency: currency ?? 'TRY',
      companyId: user.companyId,
    },
    include: { product: { select: { id: true, name: true, code: true, unit: true } } },
  });

  return NextResponse.json(price);
}
