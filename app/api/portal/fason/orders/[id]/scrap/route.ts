import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, subcontractorId: user.subcontractorId, companyId: user.companyId },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { materialId, materialVariantId, quantity, reason } = await req.json();
  const qty = parseFloat(quantity) || 0;
  if (!materialId || qty <= 0) {
    return NextResponse.json({ error: 'materialId ve quantity gerekli' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Fasoncu stoğundan düş
    const stock = await tx.subcontractorStock.findFirst({
      where: {
        subcontractorId: user.subcontractorId,
        materialId,
        materialVariantId: materialVariantId || null,
      },
    });
    if (stock) {
      await tx.subcontractorStock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: qty } },
      });
    }

    // Fire kaydı oluştur
    await tx.subcontractorScrap.create({
      data: {
        companyId: user.companyId,
        orderId: params.id,
        materialId,
        materialVariantId: materialVariantId || null,
        quantity: qty,
        reason: reason || null,
        reportedBy: user.email,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
