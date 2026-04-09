import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      product: {
        include: {
          parts: {
            include: {
              material: { select: { id: true, name: true, stock: true } },
              materialVariant: { select: { id: true, colorName: true, code: true, stock: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!order.product) return NextResponse.json([]);

  // Fasoncu stok durumunu getir
  const subcontractorStocks = await prisma.subcontractorStock.findMany({
    where: { subcontractorId: order.subcontractorId },
  });
  const stockMap = new Map(
    subcontractorStocks.map(s => [`${s.materialId}:${s.materialVariantId ?? ''}`, s.quantity])
  );

  const requirements = order.product.parts.map(part => {
    // BOM kg hesabı: totalPairs × gramsPerPiece × (1 + wasteRate/100) / 1000
    const kgRequired = (part.gramsPerPiece * (1 + part.wasteRate / 100) * order.totalPairs) / 1000;
    const stockKey = `${part.materialId}:${part.materialVariantId ?? ''}`;
    const currentStock = stockMap.get(stockKey) ?? 0;
    return {
      partId: part.id,
      partName: part.name,
      materialId: part.materialId,
      materialVariantId: part.materialVariantId,
      materialName: part.material?.name ?? '—',
      variantName: part.materialVariant ? `${part.materialVariant.colorName}${part.materialVariant.code ? ` (${part.materialVariant.code})` : ''}` : null,
      gramsPerPiece: part.gramsPerPiece,
      wasteRate: part.wasteRate,
      kgRequired: Math.round(kgRequired * 1000) / 1000,
      currentSubcontractorStock: currentStock,
      deficit: Math.max(0, Math.round((kgRequired - currentStock) * 1000) / 1000),
    };
  });

  return NextResponse.json(requirements);
}
