export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user?.type !== 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { companyId: user.companyId, portalVisible: true },
    select: { id: true, code: true, name: true, description: true, sizes: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(products);
}
