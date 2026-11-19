export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isOrderStatus, notifyOrderStatus, saveShipment } from '@/lib/order-notify';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      portalCustomer: { select: { id: true, name: true, email: true } },
      product: {
        include: {
          parts: {
            include: { material: { select: { id: true, name: true, stock: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      link: { select: { id: true, buyerCompany: { select: { name: true } } } },
      shipment: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      subcontractorOrders: {
        include: { subcontractor: { select: { id: true, name: true } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Paket siparişte her kalemin ürün reçetesi (hammadde ihtiyacı hesabı için)
  const itemIds = Array.isArray(order.orderItems)
    ? Array.from(new Set((order.orderItems as any[]).map(i => i?.productId).filter((x): x is string => typeof x === 'string')))
    : [];
  const itemProducts = itemIds.length
    ? await prisma.product.findMany({
        where: { id: { in: itemIds }, companyId: user.companyId },
        select: {
          id: true, name: true, code: true, unit: true, unitPrice: true,
          parts: { include: { material: { select: { id: true, name: true, stock: true } } }, orderBy: { sortOrder: 'asc' } },
        },
      })
    : [];
  return NextResponse.json({ ...order, itemProducts });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { status, confirmedDeliveryDate, notes, partVariantsData, shipment } = body;

  if (status !== undefined && !isOrderStatus(status)) return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
  if (shipment && !shipment.shipmentDate) return NextResponse.json({ error: 'Sevk tarihi gerekli' }, { status: 400 });

  const updateData: any = {};
  const statusChanged = !!status && status !== existing.status;
  if (statusChanged) {
    updateData.status = status;
    updateData.statusHistory = {
      create: { status, note: body.statusNote || null },
    };
  }
  if (confirmedDeliveryDate !== undefined) updateData.confirmedDeliveryDate = confirmedDeliveryDate ? new Date(confirmedDeliveryDate) : null;
  if (notes !== undefined) updateData.notes = notes;
  if (partVariantsData !== undefined) updateData.partVariantsData = partVariantsData;

  const order = await prisma.soleOrder.update({
    where: { id: params.id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true } },
      portalCustomer: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, code: true } },
      shipment: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (statusChanged) await notifyOrderStatus(params.id, status, body.statusNote || null);

  // Sevkiyat: kaydedilir; sipariş sevk edilmemişse durum "Sevk Edildi" olur ve müşteriye bildirilir
  if (shipment) {
    const r = await saveShipment(order, shipment);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  }

  return NextResponse.json(order);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Soft delete: mark as CANCELLED
  await prisma.soleOrder.update({
    where: { id: params.id },
    data: {
      status: 'CANCELLED',
      statusHistory: { create: { status: 'CANCELLED', note: 'Satıcı tarafından iptal edildi' } },
    },
  });
  if (existing.status !== 'CANCELLED') await notifyOrderStatus(params.id, 'CANCELLED');

  return NextResponse.json({ ok: true });
}
