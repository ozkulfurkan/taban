export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { catalogVisibleWhere, productImageResponse } from '@/lib/product-image-serve';

// Portal müşterisi: katalogunda görünen ürünün fotoğrafı
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type !== 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const visible = await prisma.product.findFirst({ where: { id: params.id, ...catalogVisibleWhere(user.companyId, user.id) }, select: { id: true } });
  if (!visible) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return productImageResponse(visible.id);
}
