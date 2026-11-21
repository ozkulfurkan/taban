export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { notifyOrderConfirmed } from '@/lib/order-notify';

// Gelen siparişi onayla: sipariş "Alındı" adımındayken satıcı onaylar (isteğe bağlı termin ve not).
// Sipariş verene (portal müşterisi ya da bağlı firma) anlık bildirim ve e-posta gider.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Siparişi onaylama yetkiniz yok' }, { status: 403 });

  const order = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId }, select: { id: true, status: true, confirmedAt: true } });
  if (!order) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });
  if (order.status !== 'ORDER_RECEIVED') return NextResponse.json({ error: 'Yalnızca yeni alınan sipariş onaylanabilir' }, { status: 409 });
  if (order.confirmedAt) return NextResponse.json({ error: 'Sipariş zaten onaylandı' }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  let termin: Date | undefined;
  if (body?.confirmedDeliveryDate) {
    termin = new Date(body.confirmedDeliveryDate);
    if (Number.isNaN(termin.getTime())) return NextResponse.json({ error: 'Geçersiz termin tarihi' }, { status: 400 });
  }

  // Aynı anda iki onay gelirse yalnızca biri geçer
  const done = await prisma.soleOrder.updateMany({
    where: { id: order.id, confirmedAt: null, status: 'ORDER_RECEIVED' },
    data: { confirmedAt: new Date(), ...(termin ? { confirmedDeliveryDate: termin } : {}) },
  });
  if (!done.count) return NextResponse.json({ error: 'Sipariş zaten onaylandı' }, { status: 409 });
  await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: 'ORDER_RECEIVED', note: `Sipariş onaylandı${note ? ` — ${note}` : ''}` } });

  await notifyOrderConfirmed(order.id, note);
  const updated = await prisma.soleOrder.findUnique({ where: { id: order.id }, select: { id: true, status: true, confirmedAt: true, confirmedDeliveryDate: true } });
  return NextResponse.json(updated);
}
