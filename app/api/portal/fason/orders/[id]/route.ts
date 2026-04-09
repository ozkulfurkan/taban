import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, subcontractorId: user.subcontractorId, companyId: user.companyId },
    include: {
      product: {
        include: {
          parts: {
            include: {
              material: { select: { id: true, name: true } },
              materialVariant: { select: { id: true, colorName: true, code: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      materialTransfers: {
        include: {
          material: { select: { id: true, name: true } },
          materialVariant: { select: { id: true, colorName: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      productionUpdates: { orderBy: { createdAt: 'asc' } },
      scraps: {
        include: {
          material: { select: { id: true, name: true } },
          materialVariant: { select: { id: true, colorName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}
