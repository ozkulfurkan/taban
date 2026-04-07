export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { portalAuthOptions } from '@/lib/portal-auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(portalAuthOptions);
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.soleOrder.findFirst({
    where: { id: params.id, portalCustomerId: user.id },
    include: {
      product: { select: { id: true, name: true, code: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      shipment: true,
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}
