import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const { productId, quantity, notes } = await req.json();
  if (!productId || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId: user.companyId },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: Number(quantity) } },
      select: { stock: true },
    }),
    (prisma as any).productStockAdjustment.create({
      data: {
        companyId: user.companyId,
        productId,
        delta: Number(quantity),
        type: 'barkod_yazdir',
        notes: notes ?? null,
      },
    }),
  ]);

  return NextResponse.json({ stock: updated.stock });
}
