export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withLastShipment } from '@/lib/order-shipments';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { BUYER_ORDER_SELECT } from '@/lib/network';

// Alıcının bağlı firmalara verdiği siparişler (satıcıdaki kayıtların alıcıya açık alanları)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const linkId = req.nextUrl.searchParams.get('linkId');
  const orders = await prisma.soleOrder.findMany({
    where: { link: { buyerCompanyId: user.companyId }, ...(linkId ? { linkId } : {}) },
    select: BUYER_ORDER_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return NextResponse.json(orders.map(withLastShipment));
}
