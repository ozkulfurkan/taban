import { NextRequest, NextResponse } from 'next/server';
import { isClosed } from '@/lib/fason';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rejectForeignRefs } from '@/lib/tenant';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, subcontractorId: user.subcontractorId, companyId: user.companyId },
    include: { product: { select: { parts: { select: { materialId: true } } } }, materialTransfers: { select: { materialId: true } } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (isClosed(order.status)) return NextResponse.json({ error: 'Kapanmış siparişe fire bildirilemez' }, { status: 400 });

  const { materialId, quantity, reason } = await req.json();
  const foreign = await rejectForeignRefs(user.companyId, { material: materialId });
  if (foreign) return foreign;
  const qty = Number(String(quantity ?? '').replace(',', '.'));
  if (!materialId || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: 'Hammadde ve miktar gerekli' }, { status: 400 });
  }
  // Fire yalnızca bu siparişin hammaddelerinden (reçetede ya da siparişe gönderilmiş)
  const orderMaterials = new Set([...(order.product?.parts ?? []).map(p => p.materialId), ...order.materialTransfers.map(t => t.materialId)]);
  if (!orderMaterials.has(materialId)) return NextResponse.json({ error: 'Bu hammadde bu siparişte kullanılmıyor' }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    // Fire zimmetten fazla olamaz
    const stock = await tx.subcontractorStock.findFirst({ where: { subcontractorId: user.subcontractorId, materialId } });
    const available = stock?.quantity ?? 0;
    if (qty > available + 1e-9) return { error: `Zimmetinizde ${available.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} kg var; fire bundan fazla olamaz` };
    await tx.subcontractorStock.update({ where: { id: stock!.id }, data: { quantity: { decrement: qty } } });
    await tx.subcontractorScrap.create({
      data: { companyId: user.companyId, orderId: params.id, materialId, quantity: qty, reason: reason ? String(reason).slice(0, 300) : null, reportedBy: user.email },
    });
    return { ok: true };
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
