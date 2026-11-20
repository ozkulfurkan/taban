export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { linkFor } from '@/lib/network';
import { catalogVisibleWhere, productImageResponse } from '@/lib/product-image-serve';

// Firma ağı: alıcı, bağlı satıcının kataloğunda görünen ürünün fotoğrafını görür
export async function GET(_req: NextRequest, { params }: { params: { id: string; productId: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'buyer');
  if (!link || link.status !== 'ACTIVE') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const portal = link.sellerCustomerId
    ? await prisma.portalCustomer.findUnique({ where: { customerId: link.sellerCustomerId }, select: { id: true } })
    : null;
  const visible = await prisma.product.findFirst({
    where: { id: params.productId, ...catalogVisibleWhere(link.sellerCompanyId, portal?.id ?? null) },
    select: { id: true },
  });
  if (!visible) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return productImageResponse(visible.id);
}
