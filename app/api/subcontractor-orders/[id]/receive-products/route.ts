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
  if (!order.productId) {
    return NextResponse.json({ error: 'Bu siparişe ürün tanımlı değil' }, { status: 400 });
  }

  const { receivedPairs, notes } = await req.json();
  const pairs = parseInt(receivedPairs) || 0;
  if (pairs <= 0) return NextResponse.json({ error: 'Geçerli adet giriniz' }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    // 1. Ürün stoğunu artır
    await tx.product.update({
      where: { id: order.productId! },
      data: { stock: { increment: pairs } },
    });

    // 2. Sipariş durumu RECEIVED
    await tx.subcontractorOrder.update({
      where: { id: params.id },
      data: { status: 'RECEIVED' },
    });

    // 3. Üretim güncelleme kaydı
    await tx.productionUpdate.create({
      data: {
        orderId: params.id,
        status: 'RECEIVED',
        completedPairs: pairs,
        notes: notes || `${pairs} çift teslim alındı`,
        updatedBy: (user as any).name ?? user.email ?? 'Admin',
      },
    });
  });

  return NextResponse.json({ ok: true });
}
