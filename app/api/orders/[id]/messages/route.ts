export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { MESSAGE_SELECT, cleanMessageBody, messageCounterparty, notifyCustomerOfMessage } from '@/lib/order-messages';

async function staffOrder(id: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return { user: null, order: null };
  const order = await prisma.soleOrder.findFirst({ where: { id, companyId: user.companyId }, select: { id: true, companyId: true, customerId: true, linkId: true, portalCustomerId: true } });
  return { user, order };
}

// Firma: siparişin mesajları ve talepleri (müşterinin mesajları okundu sayılır)
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, order } = await staffOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const messages = await prisma.orderMessage.findMany({ where: { orderId: order.id }, select: MESSAGE_SELECT, orderBy: { createdAt: 'asc' } });
  await prisma.orderMessage.updateMany({ where: { orderId: order.id, authorType: 'customer', readByStaffAt: null }, data: { readByStaffAt: new Date() } });
  return NextResponse.json(messages);
}

// Firma: müşteriye mesaj
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, order } = await staffOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = cleanMessageBody(body?.body);
  if (!text) return NextResponse.json({ error: 'Mesaj yazın' }, { status: 400 });
  if (!(await messageCounterparty(order))) {
    return NextResponse.json({ error: 'Bu siparişin mesajlaşabileceği bir karşı tarafı yok (portal hesabı ya da firma ağı bağlantısı)' }, { status: 400 });
  }
  const msg = await prisma.orderMessage.create({
    data: { orderId: order.id, companyId: order.companyId, kind: 'MESSAGE', authorType: 'staff', userId: user.id, authorName: user.name || user.email, body: text, readByStaffAt: new Date() },
    select: MESSAGE_SELECT,
  });
  await notifyCustomerOfMessage(order.id, text);
  return NextResponse.json(msg, { status: 201 });
}
