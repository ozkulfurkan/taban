export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { toDataUrl } from '@/lib/product-image';

const MAX_PRODUCTS = 200;

// Katalog PDF'i için seçilen ürünler (fotoğraflar veri adresi olarak) ve firma bilgisi.
// PDF cihazda üretilir; fotoğraflar tek istekte gelsin diye gövdeye gömülür.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.productIds)
    ? body.productIds.filter((x: unknown) => typeof x === 'string').slice(0, MAX_PRODUCTS)
    : [];
  if (!ids.length) return NextResponse.json({ error: 'Ürün seçin' }, { status: 400 });

  const [company, products] = await Promise.all([
    prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true, logoUrl: true, phone: true, address: true, taxId: true } }),
    prisma.product.findMany({
      where: { id: { in: ids }, companyId: user.companyId },
      select: {
        id: true, code: true, name: true, description: true, unit: true, unitPrice: true, currency: true,
        sizes: true, renk: true, shore: true, category: { select: { name: true } },
        image: { select: { mimeType: true, data: true } },
      },
    }),
  ]);
  // Seçim sırası korunur
  const order = new Map(ids.map((id, i) => [id, i]));
  products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return NextResponse.json({
    company,
    products: products.map(({ image, category, ...p }) => ({
      ...p, category: category?.name ?? null, image: image ? toDataUrl(image.mimeType, image.data) : null,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
