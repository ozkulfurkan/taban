export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { saveShipment } from '@/lib/order-notify';

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

  const r = await saveShipment(params.id, order.status, { shipmentDate, deliveryNoteNo, trackingNo, carrier, notes });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  const shipment = r.shipment;

  return NextResponse.json(shipment);
}
