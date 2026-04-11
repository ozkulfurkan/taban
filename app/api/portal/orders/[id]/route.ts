export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'COMPANY_OWNER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status !== 'CANCELLED') {
    return NextResponse.json({ error: 'Sadece iptal edilmiş siparişler silinebilir.' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.orderStatusHistory.deleteMany({ where: { orderId: params.id } }),
    prisma.orderShipment.deleteMany({ where: { orderId: params.id } }),
    prisma.soleOrder.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      portalCustomer: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, code: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      shipment: true,
      subcontractorOrders: {
        select: { id: true, orderNo: true, subcontractor: { select: { id: true, name: true } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}
