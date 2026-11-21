// Sipariş föyü (yazdırılabilir HTML): tek sipariş ya da liste (ör. bekleyen siparişler).
// Üretim / depo için: her sipariş için müşteri, termin, kalemler ve beden asortisi tablosu.
// Saf modül: web (yazdır / PDF olarak kaydet) ve mobil (@shared/order-print → PDF, AirPrint) aynı çıktıyı üretir.
import { formatQty, isPairUnit, orderUnit } from './order-units';
import { statusLabel } from './order-status';
import { formatDate } from './time';

export type PrintLine = {
  productId?: string | null; productCode?: string | null; productName?: string | null; color?: string | null;
  sizeDistribution?: Record<string, number> | null; totalQuantity: number; unit?: string | null;
};

export type PrintableOrder = {
  id?: string; productId?: string | null;
  orderNo: string; status: string; createdAt: string | Date; totalQuantity: number; unit?: string | null;
  requestedDeliveryDate?: string | Date | null; notes?: string | null;
  productCode?: string | null; color?: string | null; sizeDistribution?: Record<string, number> | null;
  orderItems?: PrintLine[] | null;
  product?: { id?: string; name: string; code?: string | null } | null;
  customer?: { name: string } | null;
  link?: { buyerCompany?: { name: string } | null } | null;
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const bySize = (a: string, b: string) => a.localeCompare(b, 'tr', { numeric: true });

/** Paket siparişte kalemler, tekli siparişte tek satır */
export function printLines(o: PrintableOrder): PrintLine[] {
  if (Array.isArray(o.orderItems) && o.orderItems.length) return o.orderItems;
  return [{
    productId: o.productId ?? o.product?.id ?? null,
    productCode: o.productCode || o.product?.code || '',
    productName: o.product?.name || '',
    color: o.color || '',
    sizeDistribution: o.sizeDistribution || {},
    totalQuantity: o.totalQuantity,
    unit: orderUnit(o.unit),
  }];
}

function orderBlock(o: PrintableOrder) {
  const lines = printLines(o);
  // Çift kalemlerinde beden sütunları: siparişteki tüm bedenlerin birleşimi
  const sizes = Array.from(new Set(lines.filter(l => isPairUnit(l.unit)).flatMap(l => Object.keys(l.sizeDistribution ?? {})))).sort(bySize);
  const customer = o.link?.buyerCompany?.name ?? o.customer?.name ?? '';
  const rows = lines.map(l => {
    const pair = isPairUnit(l.unit);
    return `<tr>
      <td>${l.productCode ? `<b>${esc(l.productCode)}</b> ` : ''}${esc(l.productName)}${l.color ? `<div class="muted">${esc(l.color)}</div>` : ''}</td>
      ${sizes.map(s => `<td class="n">${pair && l.sizeDistribution?.[s] ? l.sizeDistribution[s] : ''}</td>`).join('')}
      <td class="n b">${esc(formatQty(l.totalQuantity, l.unit))}</td>
    </tr>`;
  }).join('');
  return `<section>
    <div class="head">
      <div><div class="no">${esc(o.orderNo)}</div><div class="cust">${esc(customer)}</div></div>
      <div class="meta">
        <div>Sipariş: ${formatDate(o.createdAt)}</div>
        ${o.requestedDeliveryDate ? `<div>Termin: <b>${formatDate(o.requestedDeliveryDate)}</b></div>` : ''}
        <div>Durum: ${esc(statusLabel(o.status, o.unit))}</div>
      </div>
    </div>
    <table><thead><tr><th>Ürün</th>${sizes.map(s => `<th class="n">${esc(s)}</th>`).join('')}<th class="n">Toplam</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${o.notes ? `<div class="note">Not: ${esc(o.notes)}</div>` : ''}
  </section>`;
}

/** Yazdırılabilir tam HTML belgesi */
export function ordersHtml(orders: PrintableOrder[], opts: { title: string; companyName?: string | null; now?: Date }) {
  const totals = new Map<string, number>();
  for (const o of orders) for (const l of printLines(o)) {
    const u = orderUnit(l.unit);
    totals.set(u, (totals.get(u) ?? 0) + (Number(l.totalQuantity) || 0));
  }
  const summary = Array.from(totals.entries()).map(([u, n]) => formatQty(Math.round(n * 1000) / 1000, u)).join(' + ');
  return printDocument({
    ...opts,
    headline: `${orders.length} sipariş${summary ? ` · ${summary}` : ''}`,
    body: orders.length ? orders.map(orderBlock).join('') : '<p>Sipariş yok.</p>',
  });
}

/** Föy iskeleti: başlık, firma, sağda özet satırı ve tarih (sipariş ve ürün föyü aynı görünür) */
export function printDocument(o: { title: string; companyName?: string | null; now?: Date; headline: string; body: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title)}</title><style>
    body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#0f172a;margin:24px}
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px}
    h1{font-size:18px;margin:0} .muted{color:#64748b;font-size:10px}
    section{border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:10px;page-break-inside:avoid;break-inside:avoid}
    .head{display:flex;justify-content:space-between;gap:12px;margin-bottom:6px} .no{font-weight:700;font-size:13px} .cust{font-size:12px}
    .meta{text-align:right;font-size:10px;line-height:1.5}
    table{width:100%;border-collapse:collapse} th{background:#f1f5f9;padding:4px 5px;font-size:9px;text-align:left}
    td{padding:4px 5px;border-top:1px solid #e2e8f0;vertical-align:top} .n{text-align:center;white-space:nowrap} .b{font-weight:700}
    .note{margin-top:6px;font-size:10px;color:#334155}
    @page{margin:12mm}
  </style></head><body>
    <div class="top">
      <div>${o.companyName ? `<div class="muted">${esc(o.companyName)}</div>` : ''}<h1>${esc(o.title)}</h1></div>
      <div style="text-align:right"><div>${esc(o.headline)}</div><div class="muted">${formatDate(o.now ?? new Date())}</div></div>
    </div>
    ${o.body}
  </body></html>`;
}

export { esc as escapeHtml };
