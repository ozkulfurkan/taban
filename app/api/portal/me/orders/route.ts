export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createSoleOrder } from '@/lib/orders';
import { PORTAL_ORDER_SELECT, portalCatalogWhere } from '@/lib/portal-public';

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
    select: PORTAL_ORDER_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const user = await getPortalSession();
  if (!user?.customerId || !user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // Yalnızca portal kataloğunda bu müşteriye açık ürünler sipariş edilebilir
  const wanted = [body?.productId, ...(Array.isArray(body?.orderItems) ? body.orderItems.map((i: any) => i?.productId) : [])]
    .filter((id): id is string => typeof id === 'string' && id !== '');
  if (wanted.length) {
    const visible = await prisma.product.count({ where: { id: { in: Array.from(new Set(wanted)) }, ...portalCatalogWhere(user) } });
    if (visible !== new Set(wanted).size) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
  }

  const result = await createSoleOrder(
    { companyId: user.companyId, customerId: user.customerId, portalCustomerId: user.id },
    body,
  );
  if (!result.order) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.order, { status: 201 });
}
