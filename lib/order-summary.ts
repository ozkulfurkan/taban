// Siparişlerin ürün bazında özeti (ör. bekleyen siparişler: hangi üründen toplam ne kadar, hangi bedenler,
// kaç sipariş, hangi müşteriler). Saf modül: web ve mobil (@shared/order-summary) aynı sonucu üretir.
import { formatQty, isPairUnit, orderUnit } from './order-units';
import { formatDate } from './time';
import { escapeHtml, printDocument, printLines, type PrintableOrder } from './order-print';

export type ProductSummaryOrder = { id?: string; orderNo: string; customer: string; quantity: number; due: string | null };

export type ProductSummary = {
  key: string;
  productId: string | null;
  productCode: string;
  productName: string;
  unit: string;
  totalQuantity: number;
  /** Çift ürünlerde beden toplamları */
  sizeDistribution: Record<string, number>;
  orderCount: number;
  /** Müşteri başına toplam (çoktan aza) */
  customers: { name: string; quantity: number }[];
  orders: ProductSummaryOrder[];
  /** En yakın istenen termin (ISO) */
  earliestDue: string | null;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null);

/** Siparişleri ürüne göre toplar: önce kayıtlı ürün, yoksa kod + ad; farklı birimler ayrı satır */
export function summarizeByProduct(orders: PrintableOrder[]): ProductSummary[] {
  const map = new Map<string, ProductSummary>();
  for (const o of orders) {
    const customer = o.link?.buyerCompany?.name ?? o.customer?.name ?? '';
    const due = iso(o.requestedDeliveryDate);
    for (const l of printLines(o)) {
      const unit = orderUnit(l.unit ?? o.unit);
      const ident = l.productId || `${(l.productCode || '').trim().toLocaleUpperCase('tr')}|${(l.productName || '').trim().toLocaleLowerCase('tr')}`;
      const key = `${ident}|${unit}`;
      let s = map.get(key);
      if (!s) {
        s = {
          key, productId: l.productId ?? null, productCode: l.productCode || '', productName: l.productName || '', unit,
          totalQuantity: 0, sizeDistribution: {}, orderCount: 0, customers: [], orders: [], earliestDue: null,
        };
        map.set(key, s);
      }
      const qty = Number(l.totalQuantity) || 0;
      s.totalQuantity = round3(s.totalQuantity + qty);
      for (const [size, n] of Object.entries(l.sizeDistribution ?? {})) {
        const v = Number(n) || 0;
        if (v > 0) s.sizeDistribution[size] = (s.sizeDistribution[size] ?? 0) + v;
      }
      // Aynı siparişte aynı ürün birden çok satırda olabilir (farklı renk): sipariş bir kez sayılır
      const existing = s.orders.find(x => x.orderNo === o.orderNo);
      if (existing) existing.quantity = round3(existing.quantity + qty);
      else { s.orders.push({ id: o.id, orderNo: o.orderNo, customer, quantity: qty, due }); s.orderCount++; }
      const c = s.customers.find(x => x.name === customer);
      if (c) c.quantity = round3(c.quantity + qty); else s.customers.push({ name: customer, quantity: qty });
      if (due && (!s.earliestDue || due < s.earliestDue)) s.earliestDue = due;
    }
  }
  const list = Array.from(map.values());
  for (const s of list) s.customers.sort((a, b) => b.quantity - a.quantity);
  // Çok sipariş edilen üstte (birimler farklı olabildiği için miktar değil sipariş sayısı), eşitse ada göre
  return list.sort((a, b) => b.orderCount - a.orderCount || a.productName.localeCompare(b.productName, 'tr'));
}

const bySize = (a: string, b: string) => a.localeCompare(b, 'tr', { numeric: true });

/** Ürün bazlı föy: her ürün için toplam, beden dağılımı ve sipariş / müşteri dökümü */
export function productsHtml(summary: ProductSummary[], opts: { title: string; companyName?: string | null; now?: Date }) {
  const totals = new Map<string, number>();
  for (const s of summary) totals.set(s.unit, round3((totals.get(s.unit) ?? 0) + s.totalQuantity));
  const headline = `${summary.length} ürün · ${Array.from(totals.entries()).map(([u, n]) => formatQty(n, u)).join(' + ')}`;
  const block = (s: ProductSummary) => {
    const sizes = Object.keys(s.sizeDistribution).sort(bySize);
    const sizeTable = isPairUnit(s.unit) && sizes.length
      ? `<table><thead><tr>${sizes.map(z => `<th class="n">${escapeHtml(z)}</th>`).join('')}<th class="n">Toplam</th></tr></thead>
         <tbody><tr>${sizes.map(z => `<td class="n">${s.sizeDistribution[z]}</td>`).join('')}<td class="n b">${escapeHtml(formatQty(s.totalQuantity, s.unit))}</td></tr></tbody></table>`
      : '';
    const orders = s.orders.map(o => `<tr><td>${escapeHtml(o.orderNo)}</td><td>${escapeHtml(o.customer)}</td>
      <td class="n">${o.due ? formatDate(o.due) : ''}</td><td class="n b">${escapeHtml(formatQty(o.quantity, s.unit))}</td></tr>`).join('');
    return `<section>
      <div class="head">
        <div><div class="no">${s.productCode ? `${escapeHtml(s.productCode)} · ` : ''}${escapeHtml(s.productName)}</div>
          <div class="cust">${s.orderCount} sipariş · ${s.customers.length} müşteri</div></div>
        <div class="meta"><div><b>${escapeHtml(formatQty(s.totalQuantity, s.unit))}</b></div>
          ${s.earliestDue ? `<div>En yakın termin: <b>${formatDate(s.earliestDue)}</b></div>` : ''}</div>
      </div>
      ${sizeTable}
      <table style="margin-top:6px"><thead><tr><th>Sipariş</th><th>Müşteri</th><th class="n">Termin</th><th class="n">Miktar</th></tr></thead>
      <tbody>${orders}</tbody></table>
    </section>`;
  };
  return printDocument({ ...opts, headline, body: summary.length ? summary.map(block).join('') : '<p>Sipariş yok.</p>' });
}
