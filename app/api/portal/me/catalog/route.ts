export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { portalAuthOptions } from '@/lib/portal-auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(portalAuthOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { companyId: user.companyId, portalVisible: true },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(products);
}
