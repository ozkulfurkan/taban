import { NextRequest, NextResponse } from 'next/server';
import { SHIP_NOTE } from '@/lib/fason';
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
      // Fasoncuya yalnızca üretim için gereken ürün bilgisi (fiyat, maliyet ve iç notlar gönderilmez)
      product: {
        select: {
          id: true, code: true, name: true, unit: true, sizes: true, renk: true, shore: true,
          parts: {
            select: { id: true, name: true, materialId: true, gramsPerPiece: true, wasteRate: true, material: { select: { id: true, name: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      materialTransfers: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      productionUpdates: { orderBy: { createdAt: 'asc' } },
      scraps: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { companyId: _c, ...rest } = order;
  return NextResponse.json({ ...rest, shipped: order.productionUpdates.some(u => u.notes === SHIP_NOTE) });
}
