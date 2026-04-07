export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { companyId: user.companyId },
    select: { id: true, code: true, name: true, description: true, portalVisible: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, portalVisible } = await req.json();

  await prisma.product.updateMany({
    where: { id: productId, companyId: user.companyId },
    data: { portalVisible },
  });

  return NextResponse.json({ ok: true });
}
