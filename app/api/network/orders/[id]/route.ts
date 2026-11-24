export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withLastShipment } from '@/lib/order-shipments';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { BUYER_ORDER_SELECT } from '@/lib/network';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, link: { buyerCompanyId: user.companyId } },
    select: BUYER_ORDER_SELECT,
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(withLastShipment(order));
}
