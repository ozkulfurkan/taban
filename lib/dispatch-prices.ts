// Sevk fişi fiyatı: müşteriye özel fiyat → ürün liste fiyatı → yoksa elle girilir.
// Fiyat müşterinin para biriminde döner; farklı para birimindeki fiyat firmanın kayıtlı kurlarıyla çevrilir.
import { prisma } from '@/lib/prisma';

export type ResolvedPrice = { unitPrice: number; source: 'special' | 'list'; converted: boolean; originalCurrency: string };

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** amount (from para biriminde) → to para birimi; kurlar 1 USD/EUR = x TRY */
export function convertCurrency(amount: number, from: string, to: string, rates: { usdToTry: number; eurToTry: number }) {
  if (from === to) return amount;
  const tryRate = (c: string) => (c === 'TRY' ? 1 : c === 'USD' ? rates.usdToTry : c === 'EUR' ? rates.eurToTry : NaN);
  const a = tryRate(from), b = tryRate(to);
  if (!(a > 0) || !(b > 0)) return NaN;
  return (amount * a) / b;
}

export async function resolvePrices(companyId: string, customerId: string, productIds: string[]): Promise<Record<string, ResolvedPrice>> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return {};
  const [customer, company, products, special] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { currency: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { usdToTry: true, eurToTry: true } }),
    prisma.product.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, unitPrice: true, currency: true } }),
    prisma.customerProductPrice.findMany({ where: { companyId, customerId, productId: { in: ids } }, select: { productId: true, unitPrice: true, currency: true } }),
  ]);
  const target = customer?.currency ?? 'TRY';
  const rates = { usdToTry: company?.usdToTry ?? 1, eurToTry: company?.eurToTry ?? 1 };
  const out: Record<string, ResolvedPrice> = {};
  const put = (id: string, price: number, currency: string, source: ResolvedPrice['source']) => {
    if (!(price > 0)) return;
    const v = convertCurrency(price, currency, target, rates);
    if (Number.isFinite(v) && v > 0) out[id] = { unitPrice: round4(v), source, converted: currency !== target, originalCurrency: currency };
  };
  for (const p of products) put(p.id, p.unitPrice, p.currency, 'list');
  for (const s of special) put(s.productId, s.unitPrice, s.currency, 'special');
  return out;
}

/** Fiyat görme ve elle fiyat girme: firma sahibi/yönetici ya da Satışlar izni olanlar */
export function canPrice(user: { role?: string; allowedPages?: string[] } | null | undefined) {
  return user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER' || (user?.allowedPages ?? []).includes('invoices');
}
