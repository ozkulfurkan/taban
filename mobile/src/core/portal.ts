// Müşteri portalı: sipariş durumları, beden dağılımı ve sepetten sipariş gövdesi (web portalıyla aynı)
import { cleanQuantity, isPairUnit, orderUnit } from '@shared/order-units';
import { stepIndexOf } from '@shared/order-status';
import type { ShippedLine } from '@shared/shipment';

export { formatDiff } from '@shared/shipment';

export { formatQty, isPairUnit, orderUnit, unitDecimals } from '@shared/order-units';

export type CatalogProduct = {
  id: string; code: string | null; name: string; description: string | null; sizes: string[]; unit?: string | null;
  parts?: { id: string; name: string }[];
  /** Alıcının bu ürünü daha önce alması (sunucu en son alınanı üste sıralar) */
  purchased?: { count: number; lastAt: string } | null;
};

export type OrderItem = {
  productId: string | null; productCode: string; productName: string; color: string;
  sizeDistribution: Record<string, number>; totalQuantity: number;
  /** çift dışındaki birimlerde miktar */
  unit?: string; quantity?: number;
};

export type PortalOrder = {
  id: string; orderNo: string; status: string; createdAt: string; totalQuantity: number; unit?: string | null;
  productCode?: string | null; color?: string | null; material?: string | null; notes?: string | null;
  sizeDistribution: Record<string, number>; orderItems?: OrderItem[] | null;
  colorPartials?: { name: string; color: string }[] | null;
  requestedDeliveryDate?: string | null; confirmedDeliveryDate?: string | null;
  product?: { id: string; name: string; code: string | null } | null;
  statusHistory?: { id: string; status: string; note?: string | null; createdAt: string }[];
  shipment?: {
    shipmentDate: string; deliveryNoteNo?: string | null; trackingNo?: string | null; carrier?: string | null; notes?: string | null;
    /** Sevk edilen gerçek miktarlar (sipariş miktarından az/çok olabilir) */
    items?: ShippedLine[] | null; totalQuantity?: number | null;
  } | null;
};

// Durum adımları ürün birimine göre (web ile aynı kural): taban 7 adım, hammadde vb. 4 adım
export { orderSteps, statusLabel } from '@shared/order-status';
export const stepIndex = (status: string, unit?: string | null) => stepIndexOf(status, unit);

export function statusTone(status: string): 'primary' | 'warning' | 'success' | 'danger' {
  if (status === 'CANCELLED') return 'danger';
  if (status === 'SHIPPED' || status === 'READY_FOR_SHIPMENT') return 'success';
  if (status === 'ORDER_RECEIVED') return 'primary';
  return 'warning';
}

/** Web portalındaki varsayılan beden aralığı (ürüne beden tanımlanmamışsa) */
export const DEFAULT_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
export const sizesOf = (p: Pick<CatalogProduct, 'sizes'>) => (p.sizes?.length ? p.sizes : DEFAULT_SIZES);

/** Beden adetleri: boş/eksi/ondalık girişleri temizler, yalnızca 0'dan büyükleri tutar */
export function cleanSizes(sizes: string[], raw: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sizes) {
    const n = parseInt((raw[s] ?? '').replace(/\D/g, ''), 10);
    if (n > 0) out[s] = n;
  }
  return out;
}

export const sumSizes = (d: Record<string, number>) => Object.values(d).reduce((s, v) => s + (Number(v) || 0), 0);

/** Sepete eklenecek kalem; hata varsa mesaj döner. Çift: renk + beden adetleri; diğer birimler: miktar */
export function cartItem(p: CatalogProduct, color: string, raw: Record<string, string>, qtyText = ''): OrderItem | string {
  const unit = orderUnit(p.unit);
  if (!isPairUnit(unit)) {
    const quantity = cleanQuantity(qtyText, unit);
    if (quantity === null) return `Geçerli bir miktar girin (${unit}).`;
    return { productId: p.id, productCode: p.code || '', productName: p.name, color: color.trim(), sizeDistribution: {}, totalQuantity: quantity, unit, quantity };
  }
  if (!color.trim()) return 'Renk girin.';
  const sizeDistribution = cleanSizes(sizesOf(p), raw);
  const totalQuantity = sumSizes(sizeDistribution);
  if (totalQuantity === 0) return 'En az 1 adet girin.';
  return { productId: p.id, productCode: p.code || '', productName: p.name, color: color.trim(), sizeDistribution, totalQuantity, unit };
}

/** Sepetten paket sipariş gövdesi (POST /api/portal/me/orders) */
export function orderBody(items: OrderItem[], requestedDeliveryDate: string, notes: string) {
  return {
    orderItems: items,
    requestedDeliveryDate: requestedDeliveryDate || undefined,
    notes: notes.trim() || undefined,
  };
}

/** Siparişin satırları: paket siparişte kalemler, tekli siparişte tek satır */
export function orderLines(o: PortalOrder): OrderItem[] {
  if (Array.isArray(o.orderItems) && o.orderItems.length) return o.orderItems;
  return [{
    productId: o.product?.id ?? null,
    productCode: o.productCode || o.product?.code || '',
    productName: o.product?.name || '',
    color: o.color || '',
    sizeDistribution: o.sizeDistribution || {},
    totalQuantity: o.totalQuantity,
    unit: orderUnit(o.unit),
  }];
}

/** "38×12 · 39×24" biçiminde beden özeti (beden sırasıyla) */
export function sizeSummary(d: Record<string, number>) {
  return Object.entries(d)
    .filter(([, q]) => Number(q) > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }))
    .map(([s, q]) => `${s}×${q}`)
    .join(' · ');
}
