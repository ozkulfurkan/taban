import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { subcontractorId, materialVariantId, quantity, notes } = await req.json();

    if (!subcontractorId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Fasoncu ve miktar gerekli' }, { status: 400 });
    }

    const material = await prisma.material.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!material) return NextResponse.json({ error: 'Hammadde bulunamadı' }, { status: 404 });

    const subcontractor = await prisma.subcontractor.findFirst({
      where: { id: subcontractorId, companyId: user.companyId },
    });
    if (!subcontractor) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });

    const variantId: string | null = materialVariantId || null;

    await prisma.$transaction(async (tx) => {
      // Ana stoktan düş
      if (variantId) {
        await tx.materialVariant.update({
          where: { id: variantId },
          data: { stock: { decrement: quantity } },
        });
      } else {
        await tx.material.update({
          where: { id: params.id },
          data: { stock: { decrement: quantity } },
        });
      }

      // Fasoncu stokuna ekle (upsert — materialVariantId nullable olduğu için findFirst pattern)
      const existing = await tx.subcontractorStock.findFirst({
        where: {
          subcontractorId,
          materialId: params.id,
          materialVariantId: variantId,
        },
      });
      if (existing) {
        await tx.subcontractorStock.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await tx.subcontractorStock.create({
          data: {
            subcontractorId,
            materialId: params.id,
            materialVariantId: variantId,
            quantity,
          },
        });
      }

      // Transfer kaydı oluştur
      await tx.materialTransfer.create({
        data: {
          companyId: user.companyId,
          subcontractorId,
          materialId: params.id,
          materialVariantId: variantId,
          quantity,
          direction: 'OUTGOING',
          notes: notes || null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('send-to-subcontractor error:', err);
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 });
  }
}
