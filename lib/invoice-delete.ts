// Satış / iade faturasını siler: stoğu (ürün ve hammadde) geri alır, bağlı kayıtları temizler.
// Fatura bir sevk fişinden geldiyse fiş "hesaba işlenmedi" durumuna döner ve sipariş sevkiyatlarının satış bağı kalkar;
// böylece fiş yeniden hesaba işlenebilir, sipariş de istenirse "Satışa Çevir" ile faturalanabilir.
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
type User = { companyId: string; companyType?: string | null };

export async function deleteSaleInvoice(tx: Tx, user: User, invoiceId: string) {
  const existing = await tx.invoice.findFirst({
    where: { id: invoiceId, companyId: user.companyId },
    include: { items: { include: { product: { include: { parts: true } } } } },
  });
  if (!existing) return null;

  // Normal satış: stok düşülmüştü, geri ekle. İade: stok eklenmişti, geri düş.
  const sign = existing.isReturn ? -1 : 1;
  for (const item of existing.items) {
    if (!item.productId || !item.product) continue;
    await tx.product.updateMany({
      where: { id: item.productId, companyId: user.companyId },
      data: { stock: { increment: sign * item.quantity } },
    });
    // Hammadde stoğu (yalnızca taban üreticisi)
    if (user.companyType !== 'MATERIAL_SUPPLIER') {
      const partVariants: Array<{ partId: string; materialId: string }> =
        Array.isArray((item as any).partVariantsData) ? (item as any).partVariantsData : [];
      for (const part of item.product.parts) {
        const matId = partVariants.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
        if (!matId) continue;
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * item.quantity) / 1000;
        await tx.material.updateMany({
          where: { id: matId, companyId: user.companyId },
          data: { stock: { increment: sign * kgUsed } },
        });
      }
    }
  }

  // Sevk fişi ve sipariş sevkiyatları: satış bağı kalkar, fiş yeniden işlenebilir
  await tx.dispatch.updateMany({ where: { invoiceId, companyId: user.companyId }, data: { status: 'DRAFT', invoiceId: null } });
  await tx.orderShipment.updateMany({ where: { invoiceId }, data: { invoiceId: null } });

  await tx.payment.deleteMany({ where: { invoiceId } });
  await tx.invoiceItem.deleteMany({ where: { invoiceId } });
  await tx.invoice.delete({ where: { id: invoiceId } });
  return existing;
}

/** Silinmiş satışları gösteren sipariş sevkiyatı bağlarını temizler (eski kayıtlar için) */
export async function clearStaleShipmentInvoices(db: Tx | typeof import('@/lib/prisma').prisma, orderId: string) {
  const linked = await db.orderShipment.findMany({ where: { orderId, invoiceId: { not: null } }, select: { invoiceId: true } });
  if (!linked.length) return;
  const ids = Array.from(new Set(linked.map(s => s.invoiceId!)));
  const alive = new Set((await db.invoice.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(i => i.id));
  const dead = ids.filter(id => !alive.has(id));
  if (dead.length) await db.orderShipment.updateMany({ where: { orderId, invoiceId: { in: dead } }, data: { invoiceId: null } });
}
