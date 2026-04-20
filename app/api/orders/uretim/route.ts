export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orders = await prisma.soleOrder.findMany({
    where: { companyId: user.companyId, status: 'IN_PRODUCTION' },
    include: {
      customer: { select: { id: true, name: true } },
      product: {
        include: {
          parts: {
            include: { material: { select: { id: true, name: true, stock: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      shipment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Collect all pvData materialIds for bulk fetch
  const allPvMatIds = new Set<string>();
  const allPackageProductIds = new Set<string>();
  for (const order of orders) {
    const pvData = Array.isArray((order as any).partVariantsData) ? (order as any).partVariantsData : [];
    for (const pv of pvData) if (pv.materialId) allPvMatIds.add(pv.materialId);
    if (Array.isArray((order as any).orderItems)) {
      for (const item of (order as any).orderItems as any[]) {
        if (item.productId) allPackageProductIds.add(item.productId);
      }
    }
  }

  const [pvMaterials, packageProducts] = await Promise.all([
    allPvMatIds.size > 0
      ? prisma.material.findMany({ where: { id: { in: Array.from(allPvMatIds) } }, select: { id: true, name: true, stock: true } })
      : [],
    allPackageProductIds.size > 0
      ? prisma.product.findMany({
          where: { id: { in: Array.from(allPackageProductIds) } },
          include: { parts: { include: { material: { select: { id: true, name: true, stock: true } } } } },
        })
      : [],
  ]);
  const pvMaterialMap = new Map(pvMaterials.map((m: any) => [m.id, m]));
  const packageProductMap = new Map(packageProducts.map((p: any) => [p.id, p]));

  // Hammadde gereksinimi hesapla
  const materialMap = new Map<string, { materialId: string; name: string; requiredKg: number; currentStock: number }>();

  for (const order of orders) {
    const pvData: Array<{ partId: string; materialId: string }> =
      Array.isArray((order as any).partVariantsData) ? (order as any).partVariantsData : [];

    const processProduct = (product: any, qty: number) => {
      if (!product?.parts) return;
      for (const part of product.parts) {
        const matId = pvData.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
        if (!matId) continue;
        const mat = pvMaterialMap.get(matId) ?? part.material;
        if (!mat) continue;
        const kgNeeded = (part.gramsPerPiece * (1 + part.wasteRate / 100) * qty) / 1000;
        const existing = materialMap.get(matId);
        if (existing) {
          existing.requiredKg += kgNeeded;
        } else {
          materialMap.set(matId, {
            materialId: matId,
            name: mat.name,
            requiredKg: kgNeeded,
            currentStock: mat.stock ?? 0,
          });
        }
      }
    };

    const isPackage = Array.isArray((order as any).orderItems) && (order as any).orderItems.length > 0;
    if (isPackage) {
      for (const item of (order as any).orderItems as any[]) {
        if (item.productId) {
          processProduct(packageProductMap.get(item.productId), item.totalQuantity || 0);
        }
      }
    } else {
      processProduct((order as any).product, order.totalQuantity);
    }
  }

  const materialRequirements = Array.from(materialMap.values()).map(m => ({
    ...m,
    requiredKg: Math.round(m.requiredKg * 1000) / 1000,
  }));

  return NextResponse.json({ orders, materialRequirements });
}
