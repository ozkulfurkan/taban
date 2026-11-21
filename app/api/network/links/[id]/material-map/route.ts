export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { linkFor, sellerCatalog } from '@/lib/network';
import { rejectForeignRefs } from '@/lib/tenant';

// Alıcının hammaddesini bağlı satıcının ürünüyle eşleştirir (sellerProductId: null → eşleşmeyi kaldırır).
// Hammadde alıcıya ait olmalı, ürün satıcının bu alıcıya görünen kataloğunda olmalı.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'buyer');
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (link.status !== 'ACTIVE') return NextResponse.json({ error: 'Bağlantı onaylanmadı' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const materialId = typeof body?.materialId === 'string' ? body.materialId : null;
  const sellerProductId = typeof body?.sellerProductId === 'string' ? body.sellerProductId : null;
  if (!materialId) return NextResponse.json({ error: 'Hammadde seçin' }, { status: 400 });
  const foreign = await rejectForeignRefs(user.companyId, { material: materialId });
  if (foreign) return foreign;

  if (!sellerProductId) {
    await prisma.materialSupplierProduct.deleteMany({ where: { materialId, linkId: link.id, companyId: user.companyId } });
    return NextResponse.json({ ok: true, match: null });
  }
  const product = (await sellerCatalog(link)).find(p => p.id === sellerProductId);
  if (!product) return NextResponse.json({ error: 'Ürün tedarikçinin kataloğunda yok' }, { status: 404 });

  await prisma.materialSupplierProduct.upsert({
    where: { materialId_linkId: { materialId, linkId: link.id } },
    create: { companyId: user.companyId, materialId, linkId: link.id, sellerProductId },
    update: { sellerProductId },
  });
  return NextResponse.json({ ok: true, match: { productId: product.id, code: product.code, name: product.name, unit: product.unit } });
}
