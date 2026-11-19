export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createSoleOrder } from '@/lib/orders';

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

  const result = await createSoleOrder(
    { companyId: user.companyId, customerId: user.customerId, portalCustomerId: user.id },
    await req.json().catch(() => ({})),
  );
  if (!result.order) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.order, { status: 201 });
}
