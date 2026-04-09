import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET: alış faturasının hammadde girişlerini listele
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entries = await prisma.purchaseMaterial.findMany({
    where: { purchaseId: params.id },
    include: {
      material: { select: { id: true, name: true, currency: true, stock: true } },
      materialVariant: { select: { id: true, colorName: true, code: true, stock: true } },
      subcontractor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(entries);
}

// POST: hammadde girişi ekle
// subcontractorId yoksa → ana depo stoğu artar (mevcut davranış)
// subcontractorId varsa  → fasoncu stoğu artar, ana depo dokunulmaz
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { materialId, materialVariantId, kgAmount, pricePerKg, subcontractorId } = await req.json();
  const kg = parseFloat(kgAmount) || 0;
  if (!materialId || kg <= 0) return NextResponse.json({ error: 'materialId ve kgAmount gerekli' }, { status: 400 });

  const material = await prisma.material.findFirst({
    where: { id: materialId, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Hammadde bulunamadı' }, { status: 404 });

  if (materialVariantId) {
    const variant = await prisma.materialVariant.findFirst({
      where: { id: materialVariantId, materialId },
    });
    if (!variant) return NextResponse.json({ error: 'Varyant bulunamadı' }, { status: 404 });
  }

  if (subcontractorId) {
    // Fasoncu seçildi → fasoncu deposuna ekle, ana depo değişmez
    const sub = await prisma.subcontractor.findFirst({
      where: { id: subcontractorId, companyId: user.companyId },
    });
    if (!sub) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseMaterial.create({
        data: {
          purchaseId: params.id,
          materialId,
          materialVariantId: materialVariantId || null,
          kgAmount: kg,
          pricePerKg: pricePerKg ? parseFloat(pricePerKg) : null,
          subcontractorId,
        },
        include: {
          material: { select: { id: true, name: true, currency: true, stock: true } },
          materialVariant: { select: { id: true, colorName: true, code: true, stock: true } },
          subcontractor: { select: { id: true, name: true } },
        },
      });

      // SubcontractorStock upsert
      const existingStock = await tx.subcontractorStock.findFirst({
        where: {
          subcontractorId,
          materialId,
          materialVariantId: materialVariantId || null,
        },
      });

      if (existingStock) {
        await tx.subcontractorStock.update({
          where: { id: existingStock.id },
          data: { quantity: { increment: kg } },
        });
      } else {
        await tx.subcontractorStock.create({
          data: {
            subcontractorId,
            materialId,
            materialVariantId: materialVariantId || null,
            quantity: kg,
          },
        });
      }

      return created;
    });

    return NextResponse.json(entry);
  }

  // Ana depo — mevcut davranış
  if (materialVariantId) {
    const [entry] = await prisma.$transaction([
      prisma.purchaseMaterial.create({
        data: {
          purchaseId: params.id,
          materialId,
          materialVariantId,
          kgAmount: kg,
          pricePerKg: pricePerKg ? parseFloat(pricePerKg) : null,
        },
        include: {
          material: { select: { id: true, name: true, currency: true, stock: true } },
          materialVariant: { select: { id: true, colorName: true, code: true, stock: true } },
          subcontractor: { select: { id: true, name: true } },
        },
      }),
      prisma.materialVariant.update({
        where: { id: materialVariantId },
        data: { stock: { increment: kg } },
      }),
    ]);
    return NextResponse.json(entry);
  } else {
    const [entry] = await prisma.$transaction([
      prisma.purchaseMaterial.create({
        data: {
          purchaseId: params.id,
          materialId,
          kgAmount: kg,
          pricePerKg: pricePerKg ? parseFloat(pricePerKg) : null,
        },
        include: {
          material: { select: { id: true, name: true, currency: true, stock: true } },
          materialVariant: { select: { id: true, colorName: true, code: true, stock: true } },
          subcontractor: { select: { id: true, name: true } },
        },
      }),
      prisma.material.update({
        where: { id: materialId },
        data: { stock: { increment: kg } },
      }),
    ]);
    return NextResponse.json(entry);
  }
}

// DELETE: hammadde girişini sil → ilgili stok geri azalır
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { entryId } = await req.json();
  if (!entryId) return NextResponse.json({ error: 'entryId gerekli' }, { status: 400 });

  const entry = await prisma.purchaseMaterial.findFirst({
    where: { id: entryId, purchaseId: params.id },
  });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!purchase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (entry.subcontractorId) {
    // Fasoncu stoğundan geri düş
    await prisma.$transaction(async (tx) => {
      await tx.purchaseMaterial.delete({ where: { id: entryId } });

      const existingStock = await tx.subcontractorStock.findFirst({
        where: {
          subcontractorId: entry.subcontractorId!,
          materialId: entry.materialId,
          materialVariantId: entry.materialVariantId || null,
        },
      });

      if (existingStock) {
        await tx.subcontractorStock.update({
          where: { id: existingStock.id },
          data: { quantity: { decrement: entry.kgAmount } },
        });
      }
    });
  } else if (entry.materialVariantId) {
    await prisma.$transaction([
      prisma.purchaseMaterial.delete({ where: { id: entryId } }),
      prisma.materialVariant.update({
        where: { id: entry.materialVariantId },
        data: { stock: { decrement: entry.kgAmount } },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.purchaseMaterial.delete({ where: { id: entryId } }),
      prisma.material.update({
        where: { id: entry.materialId },
        data: { stock: { decrement: entry.kgAmount } },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
