export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isOrderStatus, notifyOrderStatus } from '@/lib/order-notify';


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status, note, confirmedDeliveryDate } = await req.json();
  if (!isOrderStatus(status)) return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { portalCustomer: true },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.soleOrder.update({
      where: { id: params.id },
      data: {
        status,
        ...(status !== 'CANCELLED' && status !== 'ORDER_RECEIVED' && !order.confirmedAt ? { confirmedAt: new Date() } : {}),
        ...(confirmedDeliveryDate !== undefined
          ? { confirmedDeliveryDate: confirmedDeliveryDate ? new Date(confirmedDeliveryDate) : null }
          : {}),
      },
    }),
    prisma.orderStatusHistory.create({ data: { orderId: params.id, status, note: note || null } }),
  ]);

  // Siparişi verene bildirim (portal müşterisi ya da bağlı firma)
  if (status !== order.status) await notifyOrderStatus(params.id, status, note);

  return NextResponse.json({ ok: true });
}
