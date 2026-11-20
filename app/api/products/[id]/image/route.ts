export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { decodeImage } from '@/lib/product-image';
import { productImageResponse } from '@/lib/product-image-serve';

// Ürün fotoğrafı
//  GET                       görsel (yalnızca ürünün firmasına)
//  PUT { data: base64 }      yükle / değiştir
//  PUT { data: null }        kaldır (düzenleyici DELETE yapamadığı için kaldırma da PUT ile)

async function own(productId: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const product = await prisma.product.findFirst({ where: { id: productId, companyId: user.companyId }, select: { id: true, companyId: true } });
  if (!product) return { error: NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 }) };
  return { product };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await own(params.id);
  if ('error' in r) return r.error;
  return productImageResponse(r.product.id);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await own(params.id);
  if ('error' in r) return r.error;
  const body = await req.json().catch(() => ({}));

  if (body?.data === null) {
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: r.product.id } }),
      prisma.product.update({ where: { id: r.product.id }, data: { imageUpdatedAt: null } }),
    ]);
    return NextResponse.json({ imageUpdatedAt: null });
  }

  const img = decodeImage(body?.data);
  if ('error' in img) return NextResponse.json({ error: img.error }, { status: 400 });
  const now = new Date();
  await prisma.$transaction([
    prisma.productImage.upsert({
      where: { productId: r.product.id },
      create: { productId: r.product.id, companyId: r.product.companyId, mimeType: img.mime, data: img.bytes, size: img.bytes.length },
      update: { mimeType: img.mime, data: img.bytes, size: img.bytes.length },
    }),
    prisma.product.update({ where: { id: r.product.id }, data: { imageUpdatedAt: now } }),
  ]);
  return NextResponse.json({ imageUpdatedAt: now.toISOString() });
}
