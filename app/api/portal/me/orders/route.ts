export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

async function getPortalSession() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal') return null;
  return user;
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
  const { productId, productCode, color, material, sizeDistribution, requestedDeliveryDate, notes, colorPartials } = body;

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
      colorPartials: colorPartials || null,
      status: 'ORDER_RECEIVED',
      statusHistory: {
        create: { status: 'ORDER_RECEIVED', note: 'Sipariş oluşturuldu' },
      },
    },
  });

  // Fetch portal customer + company admins for notifications
  const [portalCustomer, customer, product, adminUsers] = await Promise.all([
    prisma.portalCustomer.findUnique({ where: { id: user.id } }),
    prisma.customer.findUnique({ where: { id: user.customerId }, select: { name: true } }),
    productId ? prisma.product.findUnique({ where: { id: productId }, select: { name: true, code: true } }) : Promise.resolve(null),
    prisma.user.findMany({
      where: { companyId: user.companyId, role: { in: ['ADMIN', 'COMPANY_OWNER'] } },
      select: { email: true },
    }),
  ]);

  const adminEmails = adminUsers.map(u => u.email).filter(Boolean);

  // Build size distribution table rows
  const sizeEntries = Object.entries(sizeDistribution as Record<string, number>).filter(([, qty]) => qty > 0);
  const sizeHeaderCells = sizeEntries.map(([sz]) => `<th style="padding:6px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#475569;">${sz}</th>`).join('');
  const sizeValueCells = sizeEntries.map(([, qty]) => `<td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:500;">${qty}</td>`).join('');

  const productionHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1e293b;max-width:680px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #1e293b;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Üretim Emri</p>
      <h1 style="font-size:24px;font-weight:700;margin:0;">${orderNo}</h1>
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b;">
      <p style="margin:0;">Tarih: ${now.toLocaleDateString('tr-TR')}</p>
      ${requestedDeliveryDate ? `<p style="margin:4px 0 0;"><strong style="color:#1e293b;">İstenen Termin: ${new Date(requestedDeliveryDate).toLocaleDateString('tr-TR')}</strong></p>` : ''}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:8px 16px 8px 0;vertical-align:top;width:50%;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Müşteri</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${customer?.name ?? '—'}</p>
        ${portalCustomer ? `<p style="font-size:12px;color:#64748b;margin:2px 0 0;">${portalCustomer.email}</p>` : ''}
      </td>
      <td style="padding:8px 0 8px 16px;vertical-align:top;width:50%;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Ürün</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${productCode || product?.code || '—'}</p>
        ${product?.name ? `<p style="font-size:12px;color:#64748b;margin:2px 0 0;">${product.name}</p>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 16px 8px 0;vertical-align:top;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Renk</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${color || '—'}</p>
      </td>
      <td style="padding:8px 0 8px 16px;vertical-align:top;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Malzeme</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${material || '—'}</p>
      </td>
    </tr>
  </table>

  <div style="margin-bottom:20px;">
    <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Beden Dağılımı</p>
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr>
        ${sizeHeaderCells}
        <th style="padding:6px 12px;border:1px solid #e2e8f0;background:#dbeafe;color:#1d4ed8;font-weight:700;">Toplam</th>
      </tr></thead>
      <tbody><tr>
        ${sizeValueCells}
        <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:#1d4ed8;background:#dbeafe;">${totalQuantity}</td>
      </tr></tbody>
    </table>
  </div>

  ${notes ? `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
    <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Notlar</p>
    <p style="margin:0;color:#475569;">${notes}</p>
  </div>` : ''}

  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;gap:40px;">
    ${['Hazırlayan', 'Kontrol Eden', 'Onaylayan'].map(l => `
    <div style="flex:1;text-align:center;">
      <div style="border-bottom:1px solid #94a3b8;height:40px;margin-bottom:4px;"></div>
      <p style="font-size:11px;color:#94a3b8;margin:0;">${l}</p>
    </div>`).join('')}
  </div>
</body>
</html>`;

  // Send production sheet to company admins, CC portal customer
  if (adminEmails.length > 0) {
    sendMail({
      to: adminEmails,
      cc: portalCustomer?.email,
      subject: `Yeni Sipariş: ${orderNo} — ${customer?.name ?? ''}`,
      html: productionHtml,
      text: `Yeni sipariş alındı: ${orderNo}\nMüşteri: ${customer?.name}\nModel: ${productCode || product?.code || '—'}\nRenk: ${color || '—'}\nToplam: ${totalQuantity} çift`,
    }).catch(() => {});
  } else if (portalCustomer) {
    // Fallback: confirmation only to portal customer
    sendMail({
      to: portalCustomer.email,
      subject: `Siparişiniz alındı: ${orderNo}`,
      html: `<p>Merhaba ${portalCustomer.name ?? portalCustomer.email},</p><p><strong>${orderNo}</strong> numaralı siparişiniz alındı. Toplam: <strong>${totalQuantity}</strong> çift</p>`,
      text: `Siparişiniz alındı: ${orderNo}, Toplam: ${totalQuantity} çift`,
    }).catch(() => {});
  }

  return NextResponse.json(order, { status: 201 });
}
