import { formatQty, isPairUnit } from './order-units';

// Üretim emri e-postasının saf parçaları (birim testli)

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Üretim emri e-postasında kalem tablosu: model, renk, beden dağılımı (taban) ya da miktar */
export function itemsTableHtml(items: any[]) {
  const th = (t: string, align = 'left') => `<th style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#475569;text-align:${align};text-transform:uppercase;">${t}</th>`;
  const td = (t: string, align = 'left', bold = false) => `<td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:${align};${bold ? 'font-weight:700;' : ''}">${t}</td>`;
  const anyPair = items.some(i => isPairUnit(i.unit));
  const rows = items.map(i => {
    const sizes = Object.entries((i.sizeDistribution ?? {}) as Record<string, number>)
      .filter(([, q]) => q > 0)
      .sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }))
      .map(([sz, q]) => `${esc(sz)}×${q}`).join(' · ');
    return `<tr>${td(`<strong>${esc(i.productCode || '')}</strong> ${esc(i.productName || '')}`)}${td(esc(i.color || '—'))}${anyPair ? td(sizes || '—') : ''}${td(esc(formatQty(i.totalQuantity, i.unit)), 'right', true)}</tr>`;
  }).join('');
  return `
  <div style="margin-bottom:20px;">
    <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Sipariş Kalemleri</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead><tr>${th('Ürün')}${th('Renk')}${anyPair ? th('Beden Dağılımı') : ''}${th('Miktar', 'right')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
