import { NextRequest, NextResponse } from 'next/server';
import { consumeFromSubcontractorStock, isClosed } from '@/lib/fason';
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
    include: { product: { select: { parts: { select: { materialId: true, gramsPerPiece: true, wasteRate: true } } } } },
  });
  if (!order) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });
  if (isClosed(order.status)) {
    return NextResponse.json({ error: order.status === 'RECEIVED' ? 'Bu sipariş zaten teslim alındı' : 'İptal edilmiş sipariş teslim alınamaz' }, { status: 400 });
  }
  if (!order.productId) {
    return NextResponse.json({ error: 'Bu siparişe ürün tanımlı değil' }, { status: 400 });
  }

  const { receivedPairs, notes } = await req.json();
  const pairs = Number(receivedPairs);
  if (!Number.isInteger(pairs) || pairs <= 0) return NextResponse.json({ error: 'Geçerli adet giriniz' }, { status: 400 });
  if (pairs > order.totalPairs * 2) return NextResponse.json({ error: `Teslim alınan adet sipariş adedinin (${order.totalPairs}) çok üzerinde` }, { status: 400 });

  const done = await prisma.$transaction(async (tx) => {
    // 1. Sipariş durumu RECEIVED: yalnızca hâlâ açıksa (aynı anda iki teslim alma stoğu iki kez artırmasın)
    const claimed = await tx.subcontractorOrder.updateMany({
      where: { id: params.id, status: { notIn: ['RECEIVED', 'CANCELLED'] } },
      data: { status: 'RECEIVED' },
    });
    if (!claimed.count) return false;

    // 2. Ürün stoğunu artır
    await tx.product.update({
      where: { id: order.productId! },
      data: { stock: { increment: pairs } },
    });

    // 3. Üretimde harcanan hammadde fasoncu zimmetinden düşer (reçeteye göre)
    await consumeFromSubcontractorStock(tx, order.subcontractorId, order.product?.parts ?? [], pairs);

    // 4. Üretim güncelleme kaydı
    await tx.productionUpdate.create({
      data: {
        orderId: params.id,
        status: 'RECEIVED',
        completedPairs: pairs,
        notes: notes || `${pairs} çift teslim alındı`,
        updatedBy: (user as any).name ?? user.email ?? 'Admin',
      },
    });
    return true;
  });
  if (!done) return NextResponse.json({ error: 'Bu sipariş zaten teslim alındı' }, { status: 400 });

  return NextResponse.json({ ok: true });
}
