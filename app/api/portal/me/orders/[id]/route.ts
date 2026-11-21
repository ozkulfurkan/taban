export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PORTAL_ORDER_SELECT } from '@/lib/portal-public';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || user?.type !== 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, portalCustomerId: user.id },
    select: PORTAL_ORDER_SELECT,
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}
