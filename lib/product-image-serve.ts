import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Portal / firma ağı kataloğunda görünen ürün koşulu (sellerCatalog ve portal kataloğu ile aynı kural) */
export function catalogVisibleWhere(companyId: string, portalCustomerId: string | null) {
  return {
    companyId,
    portalVisible: true,
    OR: [
      { portalCustomers: { none: {} } },
      ...(portalCustomerId ? [{ portalCustomers: { some: { portalCustomerId } } }] : []),
    ],
  };
}

/** Ürün fotoğrafını döndürür (yetki kontrolü çağıranda); yoksa 404 */
export async function productImageResponse(productId: string) {
  const img = await prisma.productImage.findUnique({ where: { productId }, select: { mimeType: true, data: true } });
  if (!img) return NextResponse.json({ error: 'Fotoğraf yok' }, { status: 404 });
  return new NextResponse(Buffer.from(img.data), {
    headers: { 'Content-Type': img.mimeType, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
