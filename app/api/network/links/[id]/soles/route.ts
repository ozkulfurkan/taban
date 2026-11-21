export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { linkFor, sellerCatalog } from '@/lib/network';
import { suggestMatch } from '@/lib/catalog-history';

// "Tabanlarım": alıcının kendi taban modelleri, reçetedeki hammaddeler ve her hammaddenin bu tedarikçideki karşılığı.
// Eşleşme yoksa ad/kod benzerliğiyle öneri döner. Satıcı ürünü artık katalogda değilse eşleşme gösterilmez.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'buyer');
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (link.status !== 'ACTIVE') return NextResponse.json({ error: 'Bağlantı onaylanmadı' }, { status: 403 });

  const [products, maps, catalog] = await Promise.all([
    prisma.product.findMany({
      where: { companyId: user.companyId, parts: { some: { materialId: { not: null } } } },
      select: {
        id: true, code: true, name: true, unit: true,
        parts: {
          where: { materialId: { not: null } },
          select: { id: true, name: true, gramsPerPiece: true, wasteRate: true, material: { select: { id: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    }),
    prisma.materialSupplierProduct.findMany({ where: { linkId: link.id, companyId: user.companyId }, select: { materialId: true, sellerProductId: true } }),
    sellerCatalog(link),
  ]);

  const byId = new Map(catalog.map(p => [p.id, p]));
  const mapped = new Map(maps.map(m => [m.materialId, m.sellerProductId]));
  const brief = (p?: { id: string; code: string | null; name: string; unit: string | null } | null) =>
    (p ? { productId: p.id, code: p.code, name: p.name, unit: p.unit } : null);

  const soles = products.map(s => ({
    id: s.id, code: s.code, name: s.name,
    parts: s.parts.map(part => {
      const match = brief(part.material ? byId.get(mapped.get(part.material.id) ?? '') : null);
      return {
        id: part.id, name: part.name, gramsPerPiece: part.gramsPerPiece, wasteRate: part.wasteRate,
        material: part.material,
        match,
        suggestion: !match && part.material ? brief(suggestMatch(part.material.name, catalog)) : null,
      };
    }),
  }));
  return NextResponse.json({ sellerName: link.sellerCompany.name, soles }, { headers: { 'Cache-Control': 'no-store' } });
}
