// Sevkiyat miktarları: sipariş edilen ile sevk edilen arasındaki fark (ör. 500 kg → 490 / 520 kg).
// Saf modül: web, sunucu ve mobil (@shared/shipment) aynı hesabı kullanır.
import { formatQty, orderUnit, unitDecimals } from './order-units';

export type ShipLine = {
  index: number; productId: string | null; productCode: string; productName: string; unit: string; ordered: number;
};
export type ShippedLine = ShipLine & { shipped: number };

type OrderLike = {
  orderItems?: unknown; unit?: string | null; totalQuantity: number;
  productId?: string | null; productCode?: string | null; product?: { name?: string | null; code?: string | null } | null;
};

/** Siparişin sevk edilecek satırları (paket siparişte her kalem, tekli siparişte tek satır) */
export function shipLines(o: OrderLike): ShipLine[] {
  const items = Array.isArray(o.orderItems) ? (o.orderItems as any[]) : [];
  if (items.length) {
    return items.map((i, index) => ({
      index,
      productId: i?.productId ?? null,
      productCode: String(i?.productCode ?? ''),
      productName: String(i?.productName ?? ''),
      unit: orderUnit(i?.unit ?? o.unit),
      ordered: Number(i?.totalQuantity) || 0,
    }));
  }
  return [{
    index: 0, productId: o.productId ?? null, productCode: o.productCode || o.product?.code || '',
    productName: o.product?.name || '', unit: orderUnit(o.unit), ordered: Number(o.totalQuantity) || 0,
  }];
}

const round = (n: number, unit: string) => {
  const f = 10 ** unitDecimals(unit);
  return Math.round(n * f) / f;
};

/**
 * Girilen sevk miktarlarını doğrular. Boş bırakılan satır sipariş miktarı kadar sayılır;
 * 0 girilebilir (o kalem sevk edilmedi). Hata varsa mesaj döner.
 */
export function buildShipped(lines: ShipLine[], input: Record<number, unknown> | undefined): { items: ShippedLine[]; total: number } | { error: string } {
  const items: ShippedLine[] = [];
  for (const l of lines) {
    const raw = input?.[l.index];
    let shipped: number;
    if (raw === undefined || raw === null || raw === '') shipped = l.ordered;
    else {
      const n = typeof raw === 'string' ? Number(raw.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: `${l.productCode || l.productName || 'Kalem'}: geçerli bir sevk miktarı girin` };
      if (unitDecimals(l.unit) === 0 && !Number.isInteger(n)) return { error: `${l.productCode || l.productName || 'Kalem'}: ${l.unit} tam sayı olmalı` };
      shipped = round(n, l.unit);
    }
    items.push({ ...l, shipped });
  }
  if (items.every(i => i.shipped === 0)) return { error: 'En az bir kalemde sevk miktarı girin' };
  const total = items.reduce((s, i) => s + i.shipped, 0);
  return { items, total: Math.round(total * 1000) / 1000 };
}

/** Fark ve yüzde (sipariş 0 ise yüzde yok) */
export function shipDiff(ordered: number, shipped: number) {
  const diff = Math.round((shipped - ordered) * 1000) / 1000;
  const pct = ordered > 0 ? Math.round((diff / ordered) * 1000) / 10 : null;
  return { diff, pct };
}

/** "+20 kg (%4)" · "−10 kg (%2)" · "" (fark yoksa) */
export function formatDiff(ordered: number, shipped: number, unit?: string | null) {
  const { diff, pct } = shipDiff(ordered, shipped);
  if (diff === 0) return '';
  const sign = diff > 0 ? '+' : '−';
  const qty = formatQty(Math.abs(diff), unit);
  // Yüzde %0,1'in altındaysa gösterilmez ("%0" yanıltıcı)
  return pct === null || Math.abs(pct) < 0.1 ? `${sign}${qty}` : `${sign}${qty} (%${Math.abs(pct).toLocaleString('tr-TR')})`;
}
