import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { historyFromRecords, sortByHistory, type PurchaseRecord, type PurchaseStat } from '@/lib/catalog-history';

// Firmalar arası bağlantı (firma ağı): firma kodu, bağlantı erişimi, katalog ve sipariş görünümü.
// Bir firmanın başka firmanın verisine eriştiği her yol buradan geçer.

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 0/O ve 1/I karışmasın diye yok

export function newCompanyCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `SC-${s}`;
}

/** Kullanıcının yazdığı kodu biçime getirir: "sc 7k4p9q", "7K4P9Q" → "SC-7K4P9Q"; geçersizse null */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^SC/, '');
  if (raw.length !== 6 || raw.split('').some(ch => !CODE_ALPHABET.includes(ch))) return null;
  return `SC-${raw}`;
}

/** Firmanın kodu yoksa üretir (çakışmada yeniden dener) */
export async function ensureCompanyCode(companyId: string): Promise<string> {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { code: true } });
  if (c?.code) return c.code;
  return regenerateCompanyCode(companyId);
}

export async function regenerateCompanyCode(companyId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCompanyCode();
    try {
      await prisma.company.update({ where: { id: companyId }, data: { code } });
      return code;
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
    }
  }
  throw new Error('Firma kodu üretilemedi');
}

export type LinkSide = 'buyer' | 'seller';

/** Firmanın taraf olduğu bağlantı; başka firmanınkiyse null (404) */
export async function linkFor(companyId: string, linkId: string, side?: LinkSide) {
  const link = await prisma.companyLink.findUnique({
    where: { id: linkId },
    include: {
      buyerCompany: { select: { id: true, name: true } },
      sellerCompany: { select: { id: true, name: true } },
    },
  });
  if (!link) return null;
  const mine = side === 'buyer' ? link.buyerCompanyId === companyId
    : side === 'seller' ? link.sellerCompanyId === companyId
    : link.buyerCompanyId === companyId || link.sellerCompanyId === companyId;
  return mine ? link : null;
}

/**
 * Alıcının satıcı kataloğu: satıcının portalda görünür ürünleri. Belirli portal müşterilerine
 * kısıtlanmış ürünler, alıcıyla eşlenen müşterinin portal hesabı listedeyse görünür. Fiyat dönmez.
 */
export async function sellerCatalog(link: { sellerCompanyId: string; sellerCustomerId: string | null }) {
  const portal = link.sellerCustomerId
    ? await prisma.portalCustomer.findUnique({ where: { customerId: link.sellerCustomerId }, select: { id: true } })
    : null;
  return prisma.product.findMany({
    where: {
      companyId: link.sellerCompanyId,
      portalVisible: true,
      OR: [
        { portalCustomers: { none: {} } },
        ...(portal ? [{ portalCustomers: { some: { portalCustomerId: portal.id } } }] : []),
      ],
    },
    select: { id: true, code: true, name: true, description: true, sizes: true, unit: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Müşterinin satıcıdan alım geçmişi (ürün başına adet + son tarih): satıcıdaki iptal edilmemiş siparişler
 * (portal, firma ağı, telefonla girilen) ve satıcının o müşteriye kestiği iade olmayan faturalar.
 * Katalogda "daha önce aldıklarınız" sıralaması için.
 */
export async function purchaseHistory(sellerCompanyId: string, customerId: string | null | undefined) {
  if (!customerId) return new Map<string, PurchaseStat>();
  const [orders, invoiceItems] = await Promise.all([
    prisma.soleOrder.findMany({
      where: { companyId: sellerCompanyId, customerId, status: { not: 'CANCELLED' } },
      select: { createdAt: true, productId: true, orderItems: true },
      orderBy: { createdAt: 'desc' }, take: 500,
    }),
    prisma.invoiceItem.findMany({
      where: { productId: { not: null }, invoice: { companyId: sellerCompanyId, customerId, isReturn: false } },
      select: { productId: true, invoice: { select: { date: true } } },
      orderBy: { invoice: { date: 'desc' } }, take: 1000,
    }),
  ]);
  const records: PurchaseRecord[] = [];
  for (const o of orders) {
    const items = Array.isArray(o.orderItems) ? (o.orderItems as { productId?: string | null }[]) : [];
    if (items.length) for (const i of items) records.push({ productId: i?.productId, at: o.createdAt });
    else records.push({ productId: o.productId, at: o.createdAt });
  }
  for (const i of invoiceItems) records.push({ productId: i.productId, at: i.invoice.date });
  return historyFromRecords(records);
}

/** Satıcı kataloğu, alıcının daha önce aldıkları üstte */
export async function sellerCatalogWithHistory(link: { sellerCompanyId: string; sellerCustomerId: string | null }) {
  const [products, history] = await Promise.all([sellerCatalog(link), purchaseHistory(link.sellerCompanyId, link.sellerCustomerId)]);
  return sortByHistory(products, history);
}

/** Alıcıya gösterilen sipariş alanları (satıcının iç kayıt kimlikleri dönmez) */
export const BUYER_ORDER_SELECT = {
  id: true, orderNo: true, status: true, createdAt: true, totalQuantity: true, unit: true,
  productCode: true, color: true, material: true, notes: true,
  sizeDistribution: true, orderItems: true, colorPartials: true,
  requestedDeliveryDate: true, confirmedDeliveryDate: true,
  linkId: true,
  link: { select: { sellerCompany: { select: { name: true } } } },
  statusHistory: { select: { id: true, status: true, note: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  shipment: { select: { shipmentDate: true, deliveryNoteNo: true, trackingNo: true, carrier: true, notes: true, items: true, totalQuantity: true } },
} as const;

/** Sepet kalemlerindeki ürünler satıcının alıcıya açık kataloğunda mı */
export function itemsInCatalog(orderItems: unknown, catalogIds: Set<string>) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return false;
  return orderItems.every((i: any) => typeof i?.productId === 'string' && catalogIds.has(i.productId));
}
