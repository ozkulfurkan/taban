export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { portalOrdersWhere } from '@/lib/portal-public';
import { MESSAGE_SELECT, cleanMessageBody, notifyStaffOfMessage, requestError } from '@/lib/order-messages';

async function portalOrder(id: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || !user?.customerId || !user?.companyId) return { user: null, order: null };
  const order = await prisma.soleOrder.findFirst({ where: { id, ...portalOrdersWhere(user) }, select: { id: true, status: true, confirmedAt: true, companyId: true } });
  return { user, order };
}

// Müşteri: siparişin mesajları (firmanın mesajları okundu sayılır)
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, order } = await portalOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const messages = await prisma.orderMessage.findMany({ where: { orderId: order.id }, select: MESSAGE_SELECT, orderBy: { createdAt: 'asc' } });
  await prisma.orderMessage.updateMany({ where: { orderId: order.id, authorType: 'staff', readByCustomerAt: null }, data: { readByCustomerAt: new Date() } });
  return NextResponse.json(messages);
}

// Müşteri: mesaj ya da iptal/değişiklik talebi
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, order } = await portalOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = cleanMessageBody(body?.body);
  if (!text) return NextResponse.json({ error: 'Mesaj yazın' }, { status: 400 });
  const kind = typeof body?.kind === 'string' ? body.kind : 'MESSAGE';
  const err = await requestError(order, kind);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const msg = await prisma.orderMessage.create({
    data: {
      orderId: order.id, companyId: order.companyId, kind, authorType: 'customer', portalCustomerId: user.id,
      authorName: user.name || user.email, body: text, readByCustomerAt: new Date(),
    },
    select: MESSAGE_SELECT,
  });
  await notifyStaffOfMessage(order.id, kind, text);
  return NextResponse.json(msg, { status: 201 });
}
