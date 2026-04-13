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

    const { subcontractorId, quantity, notes } = await req.json();
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

    const subStock = await prisma.subcontractorStock.findFirst({
      where: { subcontractorId, materialId: params.id },
    });
    if (!subStock || subStock.quantity < quantity) {
      return NextResponse.json({ error: 'Fasoncuda yeterli stok yok' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.material.update({
        where: { id: params.id },
        data: { stock: { increment: quantity } },
      });
      await tx.subcontractorStock.update({
        where: { id: subStock.id },
        data: { quantity: { decrement: quantity } },
      });
      await tx.materialTransfer.create({
        data: {
          companyId: user.companyId,
          subcontractorId,
          materialId: params.id,
          quantity,
          direction: 'INCOMING',
          notes: notes || null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('receive-from-subcontractor error:', err);
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 });
  }
}
