export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { shipmentDate, deliveryNoteNo, trackingNo, carrier, notes } = body;

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { portalCustomer: true, shipment: true },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const shipment = order.shipment
    ? await prisma.orderShipment.update({
        where: { orderId: params.id },
        data: { shipmentDate: new Date(shipmentDate), deliveryNoteNo, trackingNo, carrier, notes },
      })
    : await prisma.orderShipment.create({
        data: { orderId: params.id, shipmentDate: new Date(shipmentDate), deliveryNoteNo, trackingNo, carrier, notes },
      });

  // Update order status to SHIPPED
  await prisma.$transaction([
    prisma.soleOrder.update({ where: { id: params.id }, data: { status: 'SHIPPED' } }),
    prisma.orderStatusHistory.create({ data: { orderId: params.id, status: 'SHIPPED', note: `İrsaliye: ${deliveryNoteNo ?? '-'}` } }),
  ]);

  if (!order.portalCustomer) return NextResponse.json({ ok: true });

  sendMail({
    to: order.portalCustomer.email,
    subject: `Siparişiniz sevk edildi: ${order.orderNo}`,
    html: `
      <p>Merhaba ${order.portalCustomer.name ?? order.portalCustomer.email},</p>
      <p><strong>${order.orderNo}</strong> numaralı siparişiniz sevk edilmiştir.</p>
      <table style="border-collapse:collapse;margin-top:12px;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Sevk Tarihi:</td><td><strong>${new Date(shipmentDate).toLocaleDateString('tr-TR')}</strong></td></tr>
        ${deliveryNoteNo ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">İrsaliye No:</td><td><strong>${deliveryNoteNo}</strong></td></tr>` : ''}
        ${carrier ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Taşıyıcı:</td><td><strong>${carrier}</strong></td></tr>` : ''}
        ${trackingNo ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Takip No:</td><td><strong>${trackingNo}</strong></td></tr>` : ''}
      </table>
    `,
    text: `Sipariş ${order.orderNo} sevk edildi. İrsaliye: ${deliveryNoteNo ?? '-'}`,
  }).catch(() => {});

  return NextResponse.json(shipment);
}
