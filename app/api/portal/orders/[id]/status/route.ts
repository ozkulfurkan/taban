export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Sipariş Alındı',
  IN_PRODUCTION: 'Üretime Girdi',
  MOLDING: 'Kalıplama',
  PAINTING: 'Boya / Apre',
  PACKAGING: 'Paketleme',
  READY_FOR_SHIPMENT: 'Sevkiyata Hazır',
  SHIPPED: 'Sevk Edildi',
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status, note } = await req.json();
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { portalCustomer: true },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.soleOrder.update({ where: { id: params.id }, data: { status } }),
    prisma.orderStatusHistory.create({ data: { orderId: params.id, status, note: note || null } }),
  ]);

  // Notify portal customer
  const label = STATUS_LABELS[status] ?? status;
  sendMail({
    to: order.portalCustomer.email,
    subject: `Siparişiniz güncellendi: ${label}`,
    html: `
      <p>Merhaba ${order.portalCustomer.name ?? order.portalCustomer.email},</p>
      <p><strong>${order.orderNo}</strong> numaralı siparişiniz <strong>${label}</strong> aşamasına geçti.</p>
      ${note ? `<p>Not: ${note}</p>` : ''}
    `,
    text: `Sipariş ${order.orderNo} güncellendi: ${label}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
