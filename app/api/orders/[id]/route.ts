export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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
      shipment: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      subcontractorOrders: {
        include: { subcontractor: { select: { id: true, name: true } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { status, confirmedDeliveryDate, notes, partVariantsData, shipment } = body;

  const updateData: any = {};
  if (status && status !== existing.status) {
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

  // Handle shipment upsert separately if provided
  if (shipment) {
    await prisma.orderShipment.upsert({
      where: { orderId: params.id },
      create: {
        orderId: params.id,
        shipmentDate: new Date(shipment.shipmentDate),
        deliveryNoteNo: shipment.deliveryNoteNo || null,
        trackingNo: shipment.trackingNo || null,
        carrier: shipment.carrier || null,
      },
      update: {
        shipmentDate: new Date(shipment.shipmentDate),
        deliveryNoteNo: shipment.deliveryNoteNo || null,
        trackingNo: shipment.trackingNo || null,
        carrier: shipment.carrier || null,
      },
    });
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
      statusHistory: { create: { status: 'CANCELLED', note: 'Admin tarafından iptal edildi' } },
    },
  });

  return NextResponse.json({ ok: true });
}
