// Portalda fiyat gösterimi (firma ayarı açıksa): müşteriye özel fiyat önceliklidir, yoksa ürünün satış fiyatı.
import { prisma } from '@/lib/prisma';

export type PortalPrice = { unitPrice: number; currency: string; special: boolean };

/** Ayar kapalıysa null; açıksa ürün → fiyat eşlemesi (yalnızca istenen ürünler) */
export async function portalPrices(companyId: string, customerId: string | null | undefined, productIds: string[]): Promise<Record<string, PortalPrice> | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { portalShowPrices: true } });
  if (!company?.portalShowPrices || !productIds.length) return company?.portalShowPrices ? {} : null;
  const ids = Array.from(new Set(productIds));
  const [products, special] = await Promise.all([
    prisma.product.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, unitPrice: true, currency: true } }),
    customerId ? prisma.customerProductPrice.findMany({ where: { companyId, customerId, productId: { in: ids } }, select: { productId: true, unitPrice: true, currency: true } }) : Promise.resolve([]),
  ]);
  const out: Record<string, PortalPrice> = {};
  for (const p of products) if (p.unitPrice > 0) out[p.id] = { unitPrice: p.unitPrice, currency: p.currency, special: false };
  for (const s of special) out[s.productId] = { unitPrice: s.unitPrice, currency: s.currency, special: true };
  return out;
}

/** Siparişteki ürün kimlikleri (tek ürün ya da kalemler) */
export function orderProductIds(o: { productId?: string | null; orderItems?: unknown }): string[] {
  const items = Array.isArray(o.orderItems) ? (o.orderItems as any[]) : [];
  return [o.productId, ...items.map(i => i?.productId)].filter((x): x is string => typeof x === 'string' && !!x);
}
