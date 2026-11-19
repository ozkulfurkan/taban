import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

// POST: ürün stokunu elle güncelle (delta: pozitif = ekle, negatif = çıkar).
// Her düzeltme ürün ekstresinde görünmesi için ProductStockAdjustment olarak kaydedilir.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const product = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const d = Number(body?.delta);
  if (!Number.isFinite(d) || d === 0) return NextResponse.json({ error: 'delta gerekli' }, { status: 400 });
  const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  const [updated] = await prisma.$transaction([
    prisma.product.update({
      where: { id: params.id },
      data: { stock: { increment: d } },
      select: { stock: true },
    }),
    prisma.productStockAdjustment.create({
      data: {
        companyId: user.companyId,
        productId: params.id,
        delta: d,
        type: d > 0 ? 'manuel_ekle' : 'manuel_cikar',
        notes,
      },
    }),
  ]);

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'Stock',
    entityId: params.id,
    detail: `Ürün stoku güncellendi — ${product.name} delta: ${d}`,
    meta: { delta: d, notes },
    ip: getIp(req),
  });

  return NextResponse.json({ stock: updated.stock });
}
