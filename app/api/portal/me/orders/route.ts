export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { portalAuthOptions } from '@/lib/portal-auth-options';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

async function getPortalSession() {
  const session = await getServerSession(portalAuthOptions);
  return session?.user as any;
}

export async function GET() {
  const user = await getPortalSession();
  if (!user?.customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orders = await prisma.soleOrder.findMany({
    where: { portalCustomerId: user.id },
    include: {
      product: { select: { id: true, name: true, code: true } },
      shipment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const user = await getPortalSession();
  if (!user?.customerId || !user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { productId, productCode, color, material, sizeDistribution, requestedDeliveryDate, notes } = body;

  if (!sizeDistribution || typeof sizeDistribution !== 'object') {
    return NextResponse.json({ error: 'sizeDistribution required' }, { status: 400 });
  }

  const totalQuantity = Object.values(sizeDistribution as Record<string, number>).reduce((s, v) => s + (Number(v) || 0), 0);
  if (totalQuantity === 0) return NextResponse.json({ error: 'En az 1 adet girmelisiniz' }, { status: 400 });

  const now = new Date();
  const orderNo = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  const order = await prisma.soleOrder.create({
    data: {
      companyId: user.companyId,
      customerId: user.customerId,
      portalCustomerId: user.id,
      orderNo,
      productId: productId || null,
      productCode: productCode || null,
      color: color || null,
      material: material || null,
      sizeDistribution,
      totalQuantity,
      requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : null,
      notes: notes || null,
      status: 'ORDER_RECEIVED',
      statusHistory: {
        create: { status: 'ORDER_RECEIVED', note: 'Sipariş oluşturuldu' },
      },
    },
  });

  // Confirmation email
  const portalCustomer = await prisma.portalCustomer.findUnique({ where: { id: user.id } });
  if (portalCustomer) {
    sendMail({
      to: portalCustomer.email,
      subject: `Siparişiniz alındı: ${orderNo}`,
      html: `
        <p>Merhaba ${portalCustomer.name ?? portalCustomer.email},</p>
        <p><strong>${orderNo}</strong> numaralı siparişiniz alındı.</p>
        <p>Toplam adet: <strong>${totalQuantity}</strong></p>
        ${requestedDeliveryDate ? `<p>İstenen termin: ${new Date(requestedDeliveryDate).toLocaleDateString('tr-TR')}</p>` : ''}
        <p>Siparişinizin durumunu portalde takip edebilirsiniz.</p>
      `,
      text: `Siparişiniz alındı: ${orderNo}, Toplam: ${totalQuantity} adet`,
    }).catch(() => {});
  }

  return NextResponse.json(order, { status: 201 });
}
