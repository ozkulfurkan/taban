import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!order) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });

  const { materialId, materialVariantId, quantity, notes } = await req.json();
  const qty = parseFloat(quantity) || 0;
  if (!materialId || qty <= 0) {
    return NextResponse.json({ error: 'materialId ve quantity gerekli' }, { status: 400 });
  }

  const material = await prisma.material.findFirst({
    where: { id: materialId, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Hammadde bulunamadı' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // 1. Ana depo stoğunu düş
    if (materialVariantId) {
      await tx.materialVariant.update({
        where: { id: materialVariantId },
        data: { stock: { decrement: qty } },
      });
    } else {
      await tx.material.update({
        where: { id: materialId },
        data: { stock: { decrement: qty } },
      });
    }

    // 2. Fasoncu stoğunu artır (upsert)
    const existing = await tx.subcontractorStock.findFirst({
      where: {
        subcontractorId: order.subcontractorId,
        materialId,
        materialVariantId: materialVariantId || null,
      },
    });
    if (existing) {
      await tx.subcontractorStock.update({
        where: { id: existing.id },
        data: { quantity: { increment: qty } },
      });
    } else {
      await tx.subcontractorStock.create({
        data: {
          subcontractorId: order.subcontractorId,
          materialId,
          materialVariantId: materialVariantId || null,
          quantity: qty,
        },
      });
    }

    // 3. Transfer kaydı
    await tx.materialTransfer.create({
      data: {
        companyId: user.companyId,
        subcontractorId: order.subcontractorId,
        orderId: params.id,
        materialId,
        materialVariantId: materialVariantId || null,
        quantity: qty,
        direction: 'OUTGOING',
        notes: notes || null,
      },
    });

    // 4. Sipariş PENDING ise MATERIAL_SENT yap
    if (order.status === 'PENDING') {
      await tx.subcontractorOrder.update({
        where: { id: params.id },
        data: { status: 'MATERIAL_SENT' },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
