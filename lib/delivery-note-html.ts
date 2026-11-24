// Sevk irsaliyesi (bilgi amaçlı sevk belgesi) HTML'i. Saf modül: web (yazdır / PDF olarak kaydet) ve mobil
// (@shared/delivery-note-html → expo-print) aynı çıktıyı üretir.
import { formatQty } from './order-units';

export type DeliveryNoteLine = { productCode?: string | null; productName?: string | null; unit?: string | null; ordered?: number | null; shipped: number };
export type DeliveryNoteInput = {
  company: { name: string; phone?: string | null; address?: string | null; taxId?: string | null; logoUrl?: string | null };
  customer: { name: string; address?: string | null; taxId?: string | null };
  orderNo: string;
  shipment: { shipmentDate: string | Date; deliveryNoteNo?: string | null; carrier?: string | null; trackingNo?: string | null; notes?: string | null };
  lines: DeliveryNoteLine[];
  /** Kısmi sevkiyatta "2. sevkiyat / 3" gibi bilgi */
  sequence?: { index: number; count: number } | null;
};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const safeImg = (src?: string | null) => (src && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : null);
const day = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function deliveryNoteHtml(d: DeliveryNoteInput) {
  const logo = safeImg(d.company.logoUrl);
  const total = d.lines.reduce((a, l) => a + (Number(l.shipped) || 0), 0);
  const unit = d.lines.every(l => (l.unit ?? 'çift') === (d.lines[0]?.unit ?? 'çift')) ? d.lines[0]?.unit ?? 'çift' : null;
  const rows = d.lines.map((l, i) => `<tr>
    <td>${i + 1}</td>
    <td><b>${esc(l.productCode)}</b>${l.productName ? ` · ${esc(l.productName)}` : ''}</td>
    <td class="r">${l.ordered != null ? esc(formatQty(l.ordered, l.unit)) : '—'}</td>
    <td class="r"><b>${esc(formatQty(l.shipped, l.unit))}</b></td>
  </tr>`).join('');
  const info = (k: string, v?: string | null) => (v ? `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>` : '');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>İrsaliye ${esc(d.shipment.deliveryNoteNo || d.orderNo)}</title><style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #231E19; font-size: 11pt; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6B1A2C; padding-bottom: 10px; }
header img { max-height: 48px; max-width: 160px; margin-bottom: 6px; }
.co b { font-size: 14pt; } .co div { font-size: 9pt; color: #5E554C; margin-top: 2px; }
.doc { text-align: right; } .doc h1 { font-size: 18pt; color: #6B1A2C; letter-spacing: .02em; }
.doc div { font-size: 10pt; margin-top: 3px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
.box { border: 1px solid #E7E1D9; border-radius: 6px; padding: 10px 12px; }
.box h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: .08em; color: #776D62; margin-bottom: 6px; }
.kv { display: flex; justify-content: space-between; gap: 12px; font-size: 10pt; margin-top: 3px; } .kv span { color: #776D62; }
table { width: 100%; border-collapse: collapse; margin-top: 4px; }
th, td { border-bottom: 1px solid #E7E1D9; padding: 7px 8px; text-align: left; font-size: 10pt; }
th { background: #F6F3EF; font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #5E554C; }
.r { text-align: right; } tfoot td { font-weight: bold; border-bottom: none; }
.note { margin-top: 12px; font-size: 10pt; } .sign { display: flex; justify-content: space-between; margin-top: 48px; font-size: 10pt; }
.sign div { width: 40%; border-top: 1px solid #231E19; padding-top: 6px; text-align: center; }
footer { margin-top: 24px; font-size: 8pt; color: #9A9086; text-align: center; }
</style></head><body>
<header>
  <div class="co">${logo ? `<img src="${logo}" alt=""><br>` : ''}<b>${esc(d.company.name)}</b>
    ${d.company.address ? `<div>${esc(d.company.address)}</div>` : ''}
    ${[d.company.phone, d.company.taxId ? `VKN: ${d.company.taxId}` : ''].filter(Boolean).length ? `<div>${esc([d.company.phone, d.company.taxId ? `VKN: ${d.company.taxId}` : ''].filter(Boolean).join(' · '))}</div>` : ''}
  </div>
  <div class="doc"><h1>SEVK İRSALİYESİ</h1>
    <div>No: <b>${esc(d.shipment.deliveryNoteNo || '—')}</b></div>
    <div>Sevk tarihi: <b>${day(d.shipment.shipmentDate)}</b></div>
    ${d.sequence && d.sequence.count > 1 ? `<div>${d.sequence.index}. sevkiyat / ${d.sequence.count}</div>` : ''}
  </div>
</header>
<div class="grid">
  <div class="box"><h2>Alıcı</h2><b>${esc(d.customer.name)}</b>${d.customer.address ? `<div style="font-size:10pt;margin-top:3px">${esc(d.customer.address)}</div>` : ''}${info('VKN', d.customer.taxId)}</div>
  <div class="box"><h2>Sevkiyat</h2>${info('Sipariş no', d.orderNo)}${info('Taşıyıcı', d.shipment.carrier)}${info('Takip no', d.shipment.trackingNo)}</div>
</div>
<table><thead><tr><th>#</th><th>Ürün</th><th class="r">Sipariş</th><th class="r">Sevk edilen</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td></td><td>Toplam</td><td></td><td class="r">${unit ? esc(formatQty(total, unit)) : esc(total.toLocaleString('tr-TR'))}</td></tr></tfoot></table>
${d.shipment.notes ? `<p class="note"><b>Not:</b> ${esc(d.shipment.notes)}</p>` : ''}
<div class="sign"><div>Teslim eden</div><div>Teslim alan</div></div>
<footer>Bu belge SoleCost ile hazırlanmıştır; resmî e-irsaliye yerine geçmez.</footer>
</body></html>`;
}
