import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET: faturadaki ürünlere göre hammadde kullanımını hesapla
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      items: {
        where: { productId: { not: null } },
        include: {
          product: {
            include: {
              parts: {
                include: { material: true },
              },
            },
          },
        },
      },
    },
  });

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Her hammadde için toplam kg kullanımını hesapla
  const materialMap = new Map<string, { materialId: string; name: string; currentStock: number; kgAmount: number }>();

  for (const item of invoice.items) {
    if (!item.product) continue;
    const qty = item.quantity;

    for (const part of item.product.parts) {
      if (!part.materialId || !part.material) continue;
      const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
      const kgUsed = (grossGrams * qty) / 1000;

      if (materialMap.has(part.materialId)) {
        materialMap.get(part.materialId)!.kgAmount += kgUsed;
      } else {
        materialMap.set(part.materialId, {
          materialId: part.materialId,
          name: part.material.name,
          currentStock: part.material.stock,
          kgAmount: kgUsed,
        });
      }
    }
  }

  return NextResponse.json({
    stockDeducted: invoice.stockDeducted,
    adjustments: Array.from(materialMap.values()).map(m => ({
      ...m,
      kgAmount: Math.round(m.kgAmount * 1000) / 1000,
    })),
  });
}

// POST: stok düşümünü onayla
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.stockDeducted) return NextResponse.json({ error: 'Stok düşümü zaten yapıldı' }, { status: 400 });

  const { adjustments } = await req.json() as { adjustments: { materialId: string; kgAmount: number }[] };

  await prisma.$transaction(async (tx) => {
    for (const adj of adjustments) {
      if (adj.kgAmount <= 0) continue;
      await tx.material.updateMany({
        where: { id: adj.materialId, companyId: user.companyId },
        data: { stock: { decrement: adj.kgAmount } },
      });
    }
    await tx.invoice.update({
      where: { id: params.id },
      data: { stockDeducted: true },
    });
  });

  return NextResponse.json({ ok: true });
}
