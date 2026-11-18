export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rejectForeignRefs } from '@/lib/tenant';
import { nextDocumentNumber, documentYear } from '@/lib/doc-number';

const MAX_ORDERS = 1000;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const customerId = searchParams.get('customerId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const terminFrom = searchParams.get('terminFrom');
  const terminTo = searchParams.get('terminTo');

  const where: any = {
    companyId: user.companyId,
    ...(status ? { status: status as any } : {}),
    ...(customerId ? { customerId } : {}),
    ...(from || to ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
      },
    } : {}),
    ...(terminFrom || terminTo ? {
      requestedDeliveryDate: {
        ...(terminFrom ? { gte: new Date(terminFrom) } : {}),
        ...(terminTo ? { lte: new Date(terminTo + 'T23:59:59') } : {}),
      },
    } : {}),
  };

  // Vercel yanıt sınırı için en fazla MAX_ORDERS kayıt; toplam sayı başlıkta döner
  const orders = await prisma.soleOrder.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      portalCustomer: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, code: true } },
      shipment: true,
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_ORDERS,
  });

  const total = orders.length < MAX_ORDERS ? orders.length : await prisma.soleOrder.count({ where });
  return NextResponse.json(orders, { headers: { 'X-Total-Count': String(total) } });
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
  const foreign = await rejectForeignRefs(user.companyId, {
    customer: customerId,
    product: [productId, ...(Array.isArray(orderItems) ? orderItems.map((i: any) => i?.productId) : [])],
  });
  if (foreign) return foreign;

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

  const sipPrefix = `SIP-${documentYear()}-`;

  const order = await prisma.$transaction(async (tx) => {
    const orderNo = await nextDocumentNumber('order', user.companyId, sipPrefix, { db: tx });

    return tx.soleOrder.create({
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
  });

  return NextResponse.json(order, { status: 201 });
}
