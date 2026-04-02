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
    include: { material: { select: { id: true, name: true, currency: true, stock: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(entries);
}

// POST: hammadde girişi ekle → material.stock artar
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { materialId, kgAmount, pricePerKg } = await req.json();
  const kg = parseFloat(kgAmount) || 0;
  if (!materialId || kg <= 0) return NextResponse.json({ error: 'materialId ve kgAmount gerekli' }, { status: 400 });

  const material = await prisma.material.findFirst({
    where: { id: materialId, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Hammadde bulunamadı' }, { status: 404 });

  const [entry] = await prisma.$transaction([
    prisma.purchaseMaterial.create({
      data: {
        purchaseId: params.id,
        materialId,
        kgAmount: kg,
        pricePerKg: pricePerKg ? parseFloat(pricePerKg) : null,
      },
      include: { material: { select: { id: true, name: true, currency: true, stock: true } } },
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { stock: { increment: kg } },
    }),
  ]);

  return NextResponse.json(entry);
}

// DELETE: hammadde girişini sil → material.stock geri azalır
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

  await prisma.$transaction([
    prisma.purchaseMaterial.delete({ where: { id: entryId } }),
    prisma.material.update({
      where: { id: entry.materialId },
      data: { stock: { decrement: entry.kgAmount } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
