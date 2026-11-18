import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { fmt, formatDate } from './format';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

export type PdfDoc = {
  title: string;           // "Satış Faturası", "Alış İadesi"...
  number: string;
  date: string;
  dueDate?: string | null;
  partyLabel: string;      // "Müşteri" / "Tedarikçi"
  partyName: string;
  companyName?: string | null;
  currency: string;
  lines: { code?: string | null; description: string; quantity: number; unit?: string; unitPrice: number | null; discount?: number; total: number }[];
  subtotal: number;
  vatRate?: number;
  vatAmount?: number;
  total: number;
  notes?: string | null;
};

/** Belgeyi PDF yapıp paylaşım menüsünü açar (web önizlemesinde yazdırma penceresi) */
export async function shareDocumentPdf(d: PdfDoc) {
  const rows = d.lines.map(l => `<tr>
    <td>${l.code ? `<small>[${esc(l.code)}]</small> ` : ''}${esc(l.description)}</td>
    <td class="n">${fmt(l.quantity).replace(/,00$/, '')}${l.unit ? ` ${esc(l.unit)}` : ''}</td>
    <td class="n">${l.unitPrice != null ? fmt(l.unitPrice) : ''}</td>
    ${d.lines.some(x => x.discount) ? `<td class="n">${l.discount ? `%${fmt(l.discount).replace(/,00$/, '')}` : ''}</td>` : ''}
    <td class="n">${fmt(l.total)}</td></tr>`).join('');
  const hasDisc = d.lines.some(x => x.discount);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Helvetica,sans-serif;font-size:12px;color:#0f172a;margin:28px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
    h1{font-size:20px;margin:0} .muted{color:#64748b}
    table{width:100%;border-collapse:collapse;margin-top:12px} th{background:#f1f5f9;text-align:left;padding:7px;font-size:10px;text-transform:uppercase}
    td{padding:7px;border-bottom:1px solid #e2e8f0} .n{text-align:right;white-space:nowrap}
    .tot{margin-left:auto;width:260px;margin-top:12px} .tot div{display:flex;justify-content:space-between;padding:4px 0}
    .tot .g{font-weight:700;font-size:14px;border-top:2px solid #0f172a;padding-top:8px}
  </style></head><body>
    <div class="top">
      <div>${d.companyName ? `<div class="muted">${esc(d.companyName)}</div>` : ''}<h1>${esc(d.title)}</h1><div>${esc(d.number)}</div></div>
      <div style="text-align:right"><div>Tarih: ${formatDate(d.date)}</div>${d.dueDate ? `<div>Vade: ${formatDate(d.dueDate)}</div>` : ''}</div>
    </div>
    <div><span class="muted">${esc(d.partyLabel)}:</span> <b>${esc(d.partyName)}</b></div>
    <table><thead><tr><th>Ürün / Açıklama</th><th class="n">Miktar</th><th class="n">Birim fiyat</th>${hasDisc ? '<th class="n">İsk.</th>' : ''}<th class="n">Tutar</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">
      ${d.vatRate ? `<div><span>Ara toplam</span><span>${fmt(d.subtotal)} ${esc(d.currency)}</span></div><div><span>KDV %${d.vatRate}</span><span>${fmt(d.vatAmount ?? 0)} ${esc(d.currency)}</span></div>` : ''}
      <div class="g"><span>Toplam</span><span>${fmt(d.total)} ${esc(d.currency)}</span></div>
    </div>
    ${d.notes ? `<p class="muted">Not: ${esc(d.notes)}</p>` : ''}
  </body></html>`;

  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${d.number} ${d.title}` });
}
