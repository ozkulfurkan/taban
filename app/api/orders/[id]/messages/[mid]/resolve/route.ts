export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { REQUEST_LABEL, cleanMessageBody, notifyCustomerOfMessage } from '@/lib/order-messages';
import { notifyOrderStatus } from '@/lib/order-notify';

// Firma: müşterinin iptal/değişiklik talebini onaylar ya da reddeder (isteğe bağlı açıklamayla).
// Onaylanan iptal talebi siparişi iptal eder; değişiklik talebinde siparişi firma düzenler.
export async function POST(req: NextRequest, { params }: { params: { id: string; mid: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const msg = await prisma.orderMessage.findFirst({
    where: { id: params.mid, orderId: params.id, companyId: user.companyId, kind: { in: ['CANCEL_REQUEST', 'CHANGE_REQUEST'] } },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!msg) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const resolution = body?.resolution === 'approved' ? 'approved' : body?.resolution === 'rejected' ? 'rejected' : null;
  if (!resolution) return NextResponse.json({ error: 'Onay ya da ret seçin' }, { status: 400 });
  const note = cleanMessageBody(body?.note);
  if (msg.kind === 'CANCEL_REQUEST' && resolution === 'approved' && msg.order.status === 'SHIPPED') {
    return NextResponse.json({ error: 'Sevk edilmiş sipariş iptal edilemez' }, { status: 400 });
  }

  const done = await prisma.orderMessage.updateMany({ where: { id: msg.id, resolvedAt: null }, data: { resolvedAt: new Date(), resolution, readByStaffAt: new Date() } });
  if (!done.count) return NextResponse.json({ error: 'Talep zaten yanıtlandı' }, { status: 409 });

  const label = REQUEST_LABEL[msg.kind];
  const text = `${label} ${resolution === 'approved' ? 'onaylandı' : 'reddedildi'}${note ? `: ${note}` : ''}`;
  await prisma.orderMessage.create({
    data: { orderId: msg.orderId, companyId: msg.companyId, kind: 'MESSAGE', authorType: 'staff', userId: user.id, authorName: user.name || user.email, body: text, readByStaffAt: new Date() },
  });
  if (msg.kind === 'CANCEL_REQUEST' && resolution === 'approved' && msg.order.status !== 'CANCELLED') {
    await prisma.soleOrder.update({
      where: { id: msg.orderId },
      data: { status: 'CANCELLED', statusHistory: { create: { status: 'CANCELLED', note: 'Müşterinin iptal talebi onaylandı' } } },
    });
    await notifyOrderStatus(msg.orderId, 'CANCELLED', note);
  } else {
    await notifyCustomerOfMessage(msg.orderId, text);
  }
  return NextResponse.json({ ok: true });
}
