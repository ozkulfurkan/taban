import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

// POST: stok güncelle
// subcontractorId yoksa → ana depo
// subcontractorId varsa → fasoncu stoğu (material.stock'a dokunma)
// mode 'delta': delta ile artır/azalt
// mode 'absolute': yeni stok değeri gir, type = 'stok_guncelleme'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as {
    delta?: number;
    absoluteValue?: number;
    type: string;
    notes?: string;
    subcontractorId?: string;
  };
  const { type, notes, subcontractorId } = body;

  if (subcontractorId) {
    // ── Fasoncu stok güncellemesi ──────────────────────────────────────────
    const subcontractor = await prisma.subcontractor.findFirst({
      where: { id: subcontractorId, companyId: user.companyId },
    });
    if (!subcontractor) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });

    const subStock = await prisma.subcontractorStock.findFirst({
      where: { subcontractorId, materialId: params.id },
    });
    const currentQty = subStock?.quantity ?? 0;

    let delta: number;
    if (type === 'stok_guncelleme' && typeof body.absoluteValue === 'number') {
      delta = body.absoluteValue - currentQty;
    } else if (typeof body.delta === 'number') {
      delta = body.delta;
    } else {
      return NextResponse.json({ error: 'delta veya absoluteValue gerekli' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (subStock) {
        await tx.subcontractorStock.update({
          where: { id: subStock.id },
          data: { quantity: { increment: delta } },
        });
      } else {
        await tx.subcontractorStock.create({
          data: { subcontractorId, materialId: params.id, quantity: Math.max(0, delta) },
        });
      }
      await tx.stockAdjustment.create({
        data: {
          companyId: user.companyId,
          materialId: params.id,
          subcontractorId,
          delta,
          type,
          notes: notes || null,
        },
      });
    });

    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'UPDATE',
      entity: 'Stock',
      entityId: params.id,
      detail: `Fasoncu stoku güncellendi — ${material.name} (${type}) delta: ${delta}`,
      meta: { type, delta, subcontractorId, notes },
      ip: getIp(req),
    });
    return NextResponse.json({ quantity: currentQty + delta });
  } else {
    // ── Ana depo stok güncellemesi ─────────────────────────────────────────
    let delta: number;
    if (type === 'stok_guncelleme' && typeof body.absoluteValue === 'number') {
      delta = body.absoluteValue - material.stock;
    } else if (typeof body.delta === 'number') {
      delta = body.delta;
    } else {
      return NextResponse.json({ error: 'delta veya absoluteValue gerekli' }, { status: 400 });
    }

    const [updated] = await prisma.$transaction([
      prisma.material.update({
        where: { id: params.id },
        data: { stock: { increment: delta } },
      }),
      prisma.stockAdjustment.create({
        data: {
          companyId: user.companyId,
          materialId: params.id,
          delta,
          type,
          notes: notes || null,
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
      detail: `Ana depo stoku güncellendi — ${material.name} (${type}) delta: ${delta}`,
      meta: { type, delta, notes },
      ip: getIp(req),
    });
    return NextResponse.json({ stock: updated.stock });
  }
}
