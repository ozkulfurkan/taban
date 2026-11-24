export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { portalOrdersWhere } from '@/lib/portal-public';
import { notifyStaffOfMessage } from '@/lib/order-messages';

// Müşteri siparişini kendisi iptal eder: yalnızca firma onaylamadan önce. Sonrası için iptal talebi açılır.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || !user?.customerId || !user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const order = await prisma.soleOrder.findFirst({ where: { id: params.id, ...portalOrdersWhere(user) }, select: { id: true } });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

  // Aynı anda firma onaylarsa iptal geçmez
  const done = await prisma.soleOrder.updateMany({
    where: { id: order.id, status: 'ORDER_RECEIVED', confirmedAt: null },
    data: { status: 'CANCELLED' },
  });
  if (!done.count) return NextResponse.json({ error: 'Sipariş onaylandığı için doğrudan iptal edilemez; iptal talebi gönderin.' }, { status: 409 });
  await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: 'CANCELLED', note: `Müşteri iptal etti${reason ? ` — ${reason}` : ''}` } });
  await notifyStaffOfMessage(order.id, 'CANCELLED', `Müşteri siparişi iptal etti${reason ? `: ${reason}` : ''}`);
  return NextResponse.json({ ok: true });
}
