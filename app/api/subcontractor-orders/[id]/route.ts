import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['ADMIN', 'COMPANY_OWNER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await prisma.subcontractorOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status !== 'CANCELLED') {
    return NextResponse.json({ error: 'Sadece iptal edilmiş siparişler silinebilir.' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.productionUpdate.deleteMany({ where: { orderId: params.id } }),
    prisma.materialTransfer.deleteMany({ where: { orderId: params.id } }),
    prisma.subcontractorScrap.deleteMany({ where: { orderId: params.id } }),
    prisma.subcontractorOrder.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      subcontractor: { select: { id: true, name: true, email: true } },
      product: {
        include: {
          parts: {
            include: {
              material: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      materialTransfers: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      productionUpdates: { orderBy: { createdAt: 'desc' } },
      scraps: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { status, dueDate, notes, shippingAddress } = await req.json();

  // Mevcut sipariş durumunu ve BOM'u al
  const existing = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      product: {
        include: { parts: true },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.subcontractorOrder.update({
      where: { id: params.id },
      data: {
        ...(status ? { status } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(shippingAddress !== undefined ? { shippingAddress: shippingAddress || null } : {}),
      },
      include: {
        subcontractor: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, code: true } },
      },
    });

    // Sipariş tamamlandığında fasoncu zimmetinden hammadde düş
    if (status === 'RECEIVED' && existing.status !== 'RECEIVED' && existing.product) {
      const sizeMap = (existing.sizeDistribution as Record<string, number>) ?? {};
      const totalPairs = Object.values(sizeMap).reduce((s, v) => s + (Number(v) || 0), 0);

      for (const part of existing.product.parts) {
        if (!part.materialId || totalPairs === 0) continue;
        const kgUsed = (part.gramsPerPiece * (1 + part.wasteRate / 100) * totalPairs) / 1000;

        const ss = await tx.subcontractorStock.findFirst({
          where: { subcontractorId: existing.subcontractorId, materialId: part.materialId },
        });
        if (ss) {
          await tx.subcontractorStock.update({
            where: { id: ss.id },
            data: { quantity: { decrement: kgUsed } },
          });
        }
      }
    }

    return updated;
  });

  return NextResponse.json(order);
}
