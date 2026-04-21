import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const product = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      parts: {
        include: {
          material: { select: { id: true, name: true, pricePerKg: true, currency: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      extraCosts: { orderBy: { sortOrder: 'asc' } },
      category: { select: { id: true, name: true } },
    },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { parts, extraCosts, ...productFields } = body;

  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: {
        name: productFields.name,
        code: productFields.code || null,
        description: productFields.description || null,
        unit: productFields.unit || 'çift',
        unitPrice: parseFloat(productFields.unitPrice) || 0,
        currency: productFields.currency || 'USD',
        stock: parseFloat(productFields.stock) || 0,
        notes: productFields.notes || null,
        categoryId: productFields.categoryId || null,
        sizes: Array.isArray(productFields.sizes) ? productFields.sizes : [],
        laborCostPerPair: parseFloat(productFields.laborCostPerPair) || 0,
        laborCurrency: productFields.laborCurrency || 'USD',
        ciftPerKoli: parseFloat(productFields.ciftPerKoli) || 0,
        koliFiyati: parseFloat(productFields.koliFiyati) || 0,
        koliCurrency: productFields.koliCurrency || 'USD',
      },
    });

    if (Array.isArray(parts)) {
      await tx.productPart.deleteMany({ where: { productId: params.id } });
      if (parts.length > 0) {
        await tx.productPart.createMany({
          data: parts.map((p: any, idx: number) => ({
            productId: params.id,
            materialId: p.materialId || null,
            name: p.name || '',
            gramsPerPiece: parseFloat(p.gramsPerPiece) || 0,
            wasteRate: parseFloat(p.wasteRate) || 0,
            sortOrder: idx,
          })),
        });
      }
    }

    if (Array.isArray(extraCosts)) {
      await tx.productExtraCost.deleteMany({ where: { productId: params.id } });
      if (extraCosts.length > 0) {
        await tx.productExtraCost.createMany({
          data: extraCosts.map((e: any, idx: number) => ({
            productId: params.id,
            name: e.name || '',
            amount: parseFloat(e.amount) || 0,
            currency: e.currency || 'USD',
            sortOrder: idx,
          })),
        });
      }
    }
  });

  const updated = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      parts: {
        include: {
          material: { select: { id: true, name: true, pricePerKg: true, currency: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      extraCosts: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  await prisma.product.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
