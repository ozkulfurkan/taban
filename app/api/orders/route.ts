export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const customerId = searchParams.get('customerId');

  const orders = await prisma.soleOrder.findMany({
    where: {
      companyId: user.companyId,
      ...(status ? { status: status as any } : {}),
      ...(customerId ? { customerId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      portalCustomer: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, code: true } },
      shipment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    customerId, productId, productCode, color, material,
    sizeDistribution, requestedDeliveryDate, notes,
    colorPartials, orderItems, partVariantsData,
  } = body;

  if (!customerId) return NextResponse.json({ error: 'customerId gerekli' }, { status: 400 });

  const isPackage = Array.isArray(orderItems) && orderItems.length > 0;

  let finalSizeDist: Record<string, number>;
  let finalTotalQty: number;
  let finalProductId: string | null;
  let finalProductCode: string | null;

  if (isPackage) {
    finalSizeDist = {};
    finalTotalQty = 0;
    for (const item of orderItems as any[]) {
      finalTotalQty += Number(item.totalQuantity) || 0;
      const sd = item.sizeDistribution as Record<string, number> || {};
      for (const [sz, qty] of Object.entries(sd)) {
        finalSizeDist[sz] = (finalSizeDist[sz] || 0) + (Number(qty) || 0);
      }
    }
    finalProductId = orderItems[0]?.productId || null;
    finalProductCode = orderItems[0]?.productCode || null;
  } else {
    if (!sizeDistribution || typeof sizeDistribution !== 'object') {
      return NextResponse.json({ error: 'sizeDistribution gerekli' }, { status: 400 });
    }
    finalSizeDist = sizeDistribution as Record<string, number>;
    finalTotalQty = Object.values(finalSizeDist).reduce((s, v) => s + (Number(v) || 0), 0);
    finalProductId = productId || null;
    finalProductCode = productCode || null;
  }

  if (finalTotalQty === 0) return NextResponse.json({ error: 'En az 1 adet girmelisiniz' }, { status: 400 });

  const now = new Date();
  const orderNo = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  const order = await prisma.soleOrder.create({
    data: {
      companyId: user.companyId,
      customerId,
      orderNo,
      productId: finalProductId,
      productCode: finalProductCode,
      color: isPackage ? null : (color || null),
      material: isPackage ? null : (material || null),
      sizeDistribution: finalSizeDist,
      totalQuantity: finalTotalQty,
      requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : null,
      notes: notes || null,
      colorPartials: isPackage ? null : (colorPartials || null),
      orderItems: isPackage ? orderItems : undefined,
      partVariantsData: Array.isArray(partVariantsData) && partVariantsData.length > 0 ? partVariantsData : undefined,
      status: 'ORDER_RECEIVED',
      statusHistory: {
        create: { status: 'ORDER_RECEIVED', note: 'Sipariş oluşturuldu (admin)' },
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, code: true } },
    },
  });

  // Email bildirimi — teslim makbuzu
  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } }),
    finalProductId ? prisma.product.findUnique({ where: { id: finalProductId }, select: { name: true, code: true } }) : Promise.resolve(null),
  ]);

  const adminUsers = await prisma.user.findMany({
    where: { companyId: user.companyId, role: { in: ['ADMIN', 'COMPANY_OWNER'] } },
    select: { email: true },
  });
  const adminEmails = adminUsers.map(u => u.email).filter(Boolean);
  const sizeEntries = Object.entries(finalSizeDist).filter(([, qty]) => qty > 0);
  const sizeHeaderCells = sizeEntries.map(([sz]) => `<th style="padding:6px 12px;border:1px solid #e2e8f0;">${sz}</th>`).join('');
  const sizeValueCells = sizeEntries.map(([, qty]) => `<td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;">${qty}</td>`).join('');

  const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 16px;">Yeni Sipariş: ${orderNo}</h2>
    <p><strong>Müşteri:</strong> ${customer?.name ?? customerId}</p>
    <p><strong>Model:</strong> ${finalProductCode || product?.code || '—'}</p>
    <p><strong>Toplam:</strong> ${finalTotalQty} çift</p>
    <table style="border-collapse:collapse;width:100%;margin-top:12px;">
      <thead><tr>${sizeHeaderCells}<th style="padding:6px 12px;border:1px solid #e2e8f0;background:#dbeafe;">Toplam</th></tr></thead>
      <tbody><tr>${sizeValueCells}<td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;">${finalTotalQty}</td></tr></tbody>
    </table>
  </div>`;

  if (adminEmails.length > 0) {
    sendMail({
      to: adminEmails,
      subject: `Yeni Sipariş (Admin): ${orderNo} — ${customer?.name ?? ''}`,
      html: emailHtml,
    }).catch(() => {});
  }

  return NextResponse.json(order, { status: 201 });
}
