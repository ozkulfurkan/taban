export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { messageCounterparty } from '@/lib/order-messages';
import { isForwardStatus, statusTransitionError } from '@/lib/order-status';
import { SHIPMENT_ORDER, withLastShipment } from '@/lib/order-shipments';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isOrderStatus, notifyOrderStatus, notifyOrderTermin, saveShipment } from '@/lib/order-notify';
import { partVariantMaterialIds, rejectForeignRefs } from '@/lib/tenant';

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
      shipments: { orderBy: SHIPMENT_ORDER },
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
          id: true, name: true, code: true, unit: true, unitPrice: true, sizes: true,
          parts: { include: { material: { select: { id: true, name: true, stock: true } } }, orderBy: { sortOrder: 'asc' } },
        },
      })
    : [];
  // Mesaj kutusu yalnızca karşı taraf varsa (firma ağı ya da portal) gösterilir
  const counterparty = await messageCounterparty(order);
  return NextResponse.json(withLastShipment({ ...order, itemProducts, messaging: !!counterparty, counterparty }));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { status, confirmedDeliveryDate, notes, partVariantsData, shipment } = body;

  if (partVariantsData !== undefined) {
    const foreign = await rejectForeignRefs(user.companyId, { material: partVariantMaterialIds(partVariantsData) });
    if (foreign) return foreign;
  }
  if (status !== undefined && !isOrderStatus(status)) return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
  if (status) {
    const trErr = statusTransitionError(existing.status, status, existing.unit);
    if (trErr) return NextResponse.json({ error: trErr }, { status: 400 });
  }
  if (shipment && existing.status === 'CANCELLED') return NextResponse.json({ error: 'İptal edilmiş sipariş sevk edilemez' }, { status: 400 });
  if (shipment && !shipment.shipmentDate) return NextResponse.json({ error: 'Sevk tarihi gerekli' }, { status: 400 });

  const updateData: any = {};
  const statusChanged = !!status && status !== existing.status;
  if (statusChanged) {
    updateData.status = status;
    updateData.statusHistory = {
      create: { status, note: body.statusNote || null },
    };
  }
  // Onaylanmadan ilerletilen sipariş onaylanmış sayılır (iptal hariç)
  if (statusChanged && status !== 'CANCELLED' && status !== 'ORDER_RECEIVED' && !existing.confirmedAt) updateData.confirmedAt = new Date();
  let terminChanged = false;
  if (confirmedDeliveryDate !== undefined) {
    const next = confirmedDeliveryDate ? new Date(confirmedDeliveryDate) : null;
    if (next && Number.isNaN(next.getTime())) return NextResponse.json({ error: 'Geçersiz termin tarihi' }, { status: 400 });
    updateData.confirmedDeliveryDate = next;
    terminChanged = (existing.confirmedDeliveryDate?.getTime() ?? null) !== (next?.getTime() ?? null);
  }
  if (notes !== undefined) updateData.notes = notes;
  if (partVariantsData !== undefined) updateData.partVariantsData = partVariantsData;

  const order = await prisma.soleOrder.update({
    where: { id: params.id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true } },
      portalCustomer: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, code: true } },
      shipments: { orderBy: SHIPMENT_ORDER },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (statusChanged && isForwardStatus(existing.status, status, existing.unit)) await notifyOrderStatus(params.id, status, body.statusNote || null);
  // Yalnızca termin değiştiyse (durum aynı) sipariş verene ayrıca bildirilir
  else if (terminChanged && existing.status !== 'CANCELLED' && existing.status !== 'SHIPPED') await notifyOrderTermin(params.id, updateData.confirmedDeliveryDate);

  // Sevkiyat: kaydedilir; sipariş sevk edilmemişse durum "Sevk Edildi" olur ve müşteriye bildirilir
  if (shipment) {
    const r = await saveShipment(order, shipment);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    const fresh = await prisma.soleOrder.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true } },
        portalCustomer: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, code: true } },
        shipments: { orderBy: SHIPMENT_ORDER },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    return NextResponse.json(withLastShipment(fresh!));
  }

  return NextResponse.json(withLastShipment(order));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status === 'SHIPPED') return NextResponse.json({ error: 'Sevk edilmiş sipariş iptal edilemez' }, { status: 400 });

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
