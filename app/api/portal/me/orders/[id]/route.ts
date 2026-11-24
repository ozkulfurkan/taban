export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { orderProductIds, portalPrices } from '@/lib/portal-prices';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PORTAL_ORDER_SELECT, portalOrdersWhere, toPortalOrder } from '@/lib/portal-public';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || user?.type !== 'portal' || !user?.customerId || !user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, ...portalOrdersWhere(user) },
    select: PORTAL_ORDER_SELECT,
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [prices, open] = await Promise.all([
    portalPrices(user.companyId, user.customerId, orderProductIds(order)),
    // Yanıt bekleyen talep varken yenisi açılamaz; ekran talep düğmesi yerine bekleme notu gösterir
    prisma.orderMessage.findFirst({ where: { orderId: order.id, kind: { in: ['CANCEL_REQUEST', 'CHANGE_REQUEST'] }, resolvedAt: null }, select: { kind: true } }),
  ]);
  return NextResponse.json({ ...toPortalOrder(order), openRequest: open?.kind ?? null, ...(prices ? { prices } : {}) });
}
