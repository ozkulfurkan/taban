import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { buildCustomerRows, buildSupplierRows, type StatementResult } from '@shared/statement-rows';
import { api } from './api';
import { fmt, formatDate } from './format';
import { useApi } from './query';

export type PartyKind = 'customer' | 'supplier';
const plural = (k: PartyKind) => (k === 'customer' ? 'customers' : 'suppliers');

/** Ekstre verisi ve satırları (web ile aynı hesap: lib/statement-rows).
 * linkId verilirse firma ağındaki karşı tarafın sizin için tuttuğu ekstre gelir (tür yanıttan okunur). */
export function useStatement(kind: PartyKind, id: string, from: string, to: string, linkId?: string | null) {
  const q = useApi<any>(linkId ? `/api/network/links/${linkId}/statement` : `/api/${plural(kind)}/${id}/ekstre`, { from, to });
  const k: PartyKind = linkId ? (q.data?.kind === 'supplier' ? 'supplier' : 'customer') : kind;
  const result: StatementResult | null = q.data
    ? (k === 'customer' ? buildCustomerRows(q.data) : buildSupplierRows(q.data))
    : null;
  const party = q.data ? (linkId ? q.data.party : k === 'customer' ? q.data.customer : q.data.supplier) : null;
  const owner = linkId && q.data?.company ? (q.data.company as { name: string }) : null;
  return { ...q, result, owner, party: party as { name: string; currency: string; phone?: string | null; email?: string | null } | null };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

/** Ekstreyi PDF yapıp paylaşım menüsünü açar (web önizlemesinde yazdırma penceresi) */
export async function shareStatementPdf(p: {
  partyName: string; currency: string; from: string; to: string; result: StatementResult; companyName?: string | null;
}) {
  const { rows, totalBorc, totalAlacak, lastBalance } = p.result;
  const body = rows.map(r => r.isSubRow
    ? `<tr class="sub"><td></td><td></td><td>${esc(r.productCode ? `[${r.productCode}] ` : '')}${esc(r.aciklama)}${r.miktar ? ` · ${esc(r.miktar)}` : ''}${r.fiyat != null ? ` × ${fmt(r.fiyat)}` : ''}</td><td></td><td></td><td>${r.tutar != null ? fmt(r.tutar) : ''}</td></tr>`
    : `<tr><td>${formatDate(r.date)}</td><td>${esc(r.hareket)}</td><td>${esc(r.belgeNo || '')} ${esc(r.aciklama || '')}${r.extraInfo ? `<br><small>${esc(r.extraInfo)}</small>` : ''}</td>
       <td class="n">${r.borc > 0 ? fmt(r.borc) : ''}</td><td class="n">${r.alacak > 0 ? fmt(r.alacak) : ''}</td><td class="n b">${fmt(r.bakiye)}</td></tr>`,
  ).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Helvetica,sans-serif;font-size:11px;color:#0f172a;margin:24px}
    h1{font-size:17px;margin:0} .muted{color:#64748b}
    table{width:100%;border-collapse:collapse;margin-top:14px} th{background:#f1f5f9;text-align:left;padding:6px;font-size:10px;text-transform:uppercase}
    td{padding:6px;border-bottom:1px solid #e2e8f0;vertical-align:top} .n{text-align:right;white-space:nowrap} .b{font-weight:700}
    tr.sub td{background:#fffbeb;color:#475569;font-size:10px;padding:3px 6px}
    tfoot td{font-weight:700;background:#f8fafc}
  </style></head><body>
    ${p.companyName ? `<div class="muted">${esc(p.companyName)}</div>` : ''}
    <h1>${esc(p.partyName)} — Hesap Ekstresi</h1>
    <div class="muted">${formatDate(p.from)} – ${formatDate(p.to)} · ${esc(p.currency)}</div>
    <table><thead><tr><th>Tarih</th><th>Hareket</th><th>Belge / Açıklama</th><th class="n">Borç</th><th class="n">Alacak</th><th class="n">Bakiye</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="3">Toplam</td><td class="n">${fmt(totalBorc)}</td><td class="n">${fmt(totalAlacak)}</td><td class="n">${fmt(lastBalance)} ${esc(p.currency)}</td></tr></tfoot></table>
  </body></html>`;

  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${p.partyName} hesap ekstresi` });
}

export type ShareLink = { url: string; createdAt: string; viewCount: number; lastViewedAt: string | null };

/** Aktif ekstre linkini getirir; yoksa (ya da yenile istenirse) oluşturur */
export async function ensureStatementLink(kind: PartyKind, id: string, regenerate = false): Promise<ShareLink> {
  const key = kind === 'customer' ? 'customerId' : 'supplierId';
  if (!regenerate) {
    const r = await api<{ link: ShareLink | null }>('/api/statement-links', { query: { [key]: id } });
    if (r.link) return r.link;
  }
  const r = await api<{ link: ShareLink }>('/api/statement-links', { method: 'POST', body: { [key]: id, regenerate } });
  return r.link;
}

export async function closeStatementLink(kind: PartyKind, id: string) {
  const key = kind === 'customer' ? 'customerId' : 'supplierId';
  await api('/api/statement-links', { method: 'DELETE', query: { [key]: id } });
}

export async function shareStatementLink(partyName: string, url: string) {
  const message = `Sayın ${partyName}, güncel hesap ekstrenizi bu linkten görüntüleyebilirsiniz: ${url}`;
  await Share.share(Platform.OS === 'ios' ? { message, url } : { message, title: 'Hesap Ekstresi' });
}
