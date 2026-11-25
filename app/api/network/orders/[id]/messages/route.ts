export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { MESSAGE_SELECT, cleanMessageBody, notifyStaffOfMessage } from '@/lib/order-messages';

// Firma ağı: alıcı firmanın verdiği siparişte satıcıyla mesajlaşma. Erişim GET /api/network/orders/[id] ile aynı.
async function buyerOrder(id: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return { user: null, order: null };
  const order = await prisma.soleOrder.findFirst({
    where: { id, link: { buyerCompanyId: user.companyId } },
    select: { id: true, companyId: true, link: { select: { status: true, buyerCompany: { select: { name: true } } } } },
  });
  return { user, order };
}

// Alıcı: siparişin mesajları (satıcının mesajları okundu sayılır)
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, order } = await buyerOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const messages = await prisma.orderMessage.findMany({ where: { orderId: order.id }, select: MESSAGE_SELECT, orderBy: { createdAt: 'asc' } });
  await prisma.orderMessage.updateMany({ where: { orderId: order.id, authorType: 'staff', readByCustomerAt: null }, data: { readByCustomerAt: new Date() } });
  return NextResponse.json(messages);
}

// Alıcı: satıcıya mesaj (talepler portal içindir; firma ağında mesajla iletilir)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, order } = await buyerOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (order.link?.status !== 'ACTIVE') return NextResponse.json({ error: 'Firma bağlantısı aktif değil' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const text = cleanMessageBody(body?.body);
  if (!text) return NextResponse.json({ error: 'Mesaj yazın' }, { status: 400 });
  const who = user.name || user.email;
  const msg = await prisma.orderMessage.create({
    data: {
      orderId: order.id, companyId: order.companyId, kind: 'MESSAGE', authorType: 'customer', userId: user.id,
      authorName: `${order.link.buyerCompany.name} · ${who}`.slice(0, 200), body: text, readByCustomerAt: new Date(),
    },
    select: MESSAGE_SELECT,
  });
  await notifyStaffOfMessage(order.id, 'MESSAGE', text);
  return NextResponse.json(msg, { status: 201 });
}
