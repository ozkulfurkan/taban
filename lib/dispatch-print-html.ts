// Sevk fişi yazdırma HTML'i (saf modül; web ve mobil aynı çıktıyı üretir).
// Nokta vuruşlu yazıcı için: tüm ölçüler mm, düz siyah metin, sabit genişlikli yazı, arka plan rengi ve ince çizgi yok.
// İki biçim: "full" (boş kâğıda başlık, tablo ve imza alanlarıyla tam fiş) ve "preprinted" (matbu forma yalnızca değerler,
// alan konumları ayarlardan). Kâğıt boyu: A4, A5, sürekli form 240×140 / 240×280 ya da özel.
import { formatQty } from './order-units';

export type PaperKind = 'A4' | 'A5' | 'CF240x140' | 'CF240x280' | 'CUSTOM';
export const PAPERS: Record<Exclude<PaperKind, 'CUSTOM'>, { label: string; w: number; h: number }> = {
  A4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  A5: { label: 'A5 (148 × 210 mm)', w: 148, h: 210 },
  CF240x140: { label: 'Sürekli form 240 × 140 mm (yarım)', w: 240, h: 140 },
  CF240x280: { label: 'Sürekli form 240 × 280 mm (tam)', w: 240, h: 280 },
};

export type FieldPos = { x: number; y: number };
export type FieldKey =
  | 'customer' | 'address' | 'taxId' | 'date' | 'no' | 'transport' | 'notes' | 'total'
  | 'lines' | 'colCode' | 'colName' | 'colQty' | 'colUnit' | 'colPrice' | 'colTotal';
export const FIELD_LABELS: Record<FieldKey, string> = {
  customer: 'Müşteri adı', address: 'Adres', taxId: 'Vergi no', date: 'Tarih', no: 'Fiş no', transport: 'Taşıyıcı / plaka',
  notes: 'Not', total: 'Genel toplam', lines: 'Kalemlerin başladığı yer (y)',
  colCode: 'Sütun: kod (x)', colName: 'Sütun: ürün (x)', colQty: 'Sütun: miktar (x, sağa yaslı bitiş)', colUnit: 'Sütun: birim (x)',
  colPrice: 'Sütun: birim fiyat (x, bitiş)', colTotal: 'Sütun: tutar (x, bitiş)',
};
export const DEFAULT_FIELDS: Record<FieldKey, FieldPos> = {
  customer: { x: 20, y: 26 }, address: { x: 20, y: 32 }, taxId: { x: 20, y: 38 }, transport: { x: 20, y: 44 },
  date: { x: 180, y: 26 }, no: { x: 180, y: 32 }, notes: { x: 20, y: 118 }, total: { x: 228, y: 118 },
  lines: { x: 0, y: 58 }, colCode: { x: 12, y: 0 }, colName: { x: 40, y: 0 }, colQty: { x: 160, y: 0 }, colUnit: { x: 163, y: 0 },
  colPrice: { x: 200, y: 0 }, colTotal: { x: 228, y: 0 },
};

export type PrintConfig = {
  paper: PaperKind; widthMm: number; heightMm: number;
  marginTopMm: number; marginRightMm: number; marginBottomMm: number; marginLeftMm: number;
  fontSizePt: number; lineHeightMm: number; maxLines: number;
  mode: 'full' | 'preprinted'; fieldPositions?: Partial<Record<FieldKey, FieldPos>> | null;
  showPrices: boolean; copies: number;
};
export const DEFAULT_PRINT: PrintConfig = {
  paper: 'A4', widthMm: 210, heightMm: 297, marginTopMm: 10, marginRightMm: 10, marginBottomMm: 10, marginLeftMm: 10,
  fontSizePt: 10, lineHeightMm: 6, maxLines: 20, mode: 'full', fieldPositions: null, showPrices: false, copies: 1,
};

/** Kayıtlı ayarı (eksik/hatalı alanlarla) güvenli yapılandırmaya çevirir */
export function normalizePrintConfig(s: Partial<PrintConfig> | null | undefined): PrintConfig {
  const c = { ...DEFAULT_PRINT, ...(s ?? {}) } as PrintConfig;
  const preset = c.paper !== 'CUSTOM' ? PAPERS[c.paper as keyof typeof PAPERS] : null;
  const num = (v: unknown, min: number, max: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  return {
    ...c,
    paper: preset || c.paper === 'CUSTOM' ? c.paper : 'A4',
    widthMm: preset ? preset.w : num(c.widthMm, 50, 420, 210),
    heightMm: preset ? preset.h : num(c.heightMm, 50, 600, 297),
    marginTopMm: num(c.marginTopMm, 0, 50, 10), marginRightMm: num(c.marginRightMm, 0, 50, 10),
    marginBottomMm: num(c.marginBottomMm, 0, 50, 10), marginLeftMm: num(c.marginLeftMm, 0, 50, 10),
    fontSizePt: num(c.fontSizePt, 6, 16, 10), lineHeightMm: num(c.lineHeightMm, 3, 15, 6),
    maxLines: Math.round(num(c.maxLines, 1, 80, 20)), copies: Math.round(num(c.copies, 1, 5, 1)),
    mode: c.mode === 'preprinted' ? 'preprinted' : 'full',
    showPrices: !!c.showPrices,
  };
}

export type DispatchPrintLine = { code?: string | null; name: string; unit?: string | null; qty: number; unitPrice?: number | null };
export type DispatchPrintInput = {
  company: { name: string; address?: string | null; phone?: string | null; taxId?: string | null };
  customer: { name: string; address?: string | null; taxId?: string | null };
  no: string; date: string | Date;
  carrier?: string | null; vehiclePlate?: string | null; driverName?: string | null; notes?: string | null;
  lines: DispatchPrintLine[];
  currency?: string | null; vatRate?: number | null;
};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const day = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Tutarlar: satır tutarı, ara toplam, KDV, genel toplam (fiyatı olmayan satır toplama girmez) */
export function dispatchTotals(lines: DispatchPrintLine[], vatRate = 0) {
  const lineTotals = lines.map(l => (l.unitPrice != null ? r2(l.qty * l.unitPrice) : null));
  const subtotal = r2(lineTotals.reduce<number>((a, b) => a + (b ?? 0), 0));
  const vat = r2(subtotal * (vatRate || 0) / 100);
  return { lineTotals, subtotal, vat, total: r2(subtotal + vat), missingPrice: lineTotals.some(t => t == null) };
}

/** Kalemleri sayfalara böler */
export function paginate<T>(items: T[], perPage: number): T[][] {
  const n = Math.max(1, Math.floor(perPage));
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += n) pages.push(items.slice(i, i + n));
  return pages.length ? pages : [[]];
}

const baseCss = (c: PrintConfig) => `
@page { size: ${c.widthMm}mm ${c.heightMm}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; }
body { font-family: 'Courier New', Courier, monospace; font-size: ${c.fontSizePt}pt; line-height: 1.15; -webkit-print-color-adjust: exact; }
.page { position: relative; width: ${c.widthMm}mm; height: ${c.heightMm}mm; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.abs { position: absolute; white-space: nowrap; }
.r { text-align: right; }
`;

function fullPage(d: DispatchPrintInput, c: PrintConfig, rows: DispatchPrintLine[], startIndex: number, pageNo: number, pageCount: number, totals: ReturnType<typeof dispatchTotals>) {
  const showP = c.showPrices;
  const unit = (l: DispatchPrintLine) => l.unit || 'adet';
  const body = rows.map((l, i) => {
    const t = totals.lineTotals[startIndex + i];
    return `<tr style="height:${c.lineHeightMm}mm"><td>${startIndex + i + 1}</td><td>${esc(l.code)}</td><td>${esc(l.name)}</td>
      <td class="r">${esc(formatQty(l.qty, l.unit).replace(/\s*\S+$/, ''))}</td><td>${esc(unit(l))}</td>
      ${showP ? `<td class="r">${l.unitPrice != null ? money(l.unitPrice) : ''}</td><td class="r">${t != null ? money(t) : ''}</td>` : ''}</tr>`;
  }).join('');
  const last = pageNo === pageCount;
  const cur = esc(d.currency ?? '');
  const transport = [d.carrier && `Taşıyıcı: ${esc(d.carrier)}`, d.vehiclePlate && `Plaka: ${esc(d.vehiclePlate)}`, d.driverName && `Şoför: ${esc(d.driverName)}`].filter(Boolean).join('   ');
  return `<div class="page" style="padding:${c.marginTopMm}mm ${c.marginRightMm}mm ${c.marginBottomMm}mm ${c.marginLeftMm}mm">
  <table class="hd" style="width:100%"><tr><td style="vertical-align:top"><b style="font-size:1.25em">${esc(d.company.name)}</b>
    ${d.company.address ? `<br>${esc(d.company.address)}` : ''}${d.company.phone || d.company.taxId ? `<br>${esc([d.company.phone, d.company.taxId ? `VKN: ${d.company.taxId}` : ''].filter(Boolean).join('  '))}` : ''}</td>
    <td class="r" style="vertical-align:top"><b style="font-size:1.4em">SEVK FİŞİ</b><br>No: ${esc(d.no)}<br>Tarih: ${day(d.date)}${pageCount > 1 ? `<br>Sayfa ${pageNo}/${pageCount}` : ''}</td></tr></table>
  <div style="margin-top:3mm;border-top:0.4mm solid #000;padding-top:2mm">Sayın: <b>${esc(d.customer.name)}</b>${d.customer.address ? `<br>${esc(d.customer.address)}` : ''}${d.customer.taxId ? `<br>VKN: ${esc(d.customer.taxId)}` : ''}</div>
  ${transport ? `<div style="margin-top:1.5mm">${transport}</div>` : ''}
  <table style="width:100%;border-collapse:collapse;margin-top:3mm">
    <thead><tr style="border-top:0.4mm solid #000;border-bottom:0.4mm solid #000"><th style="text-align:left;width:7%">#</th><th style="text-align:left;width:16%">Kod</th><th style="text-align:left">Ürün</th>
      <th class="r" style="width:12%">Miktar</th><th style="text-align:left;width:8%;padding-left:1.5mm">Birim</th>${showP ? '<th class="r" style="width:13%">B.Fiyat</th><th class="r" style="width:14%">Tutar</th>' : ''}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${last ? `<div style="margin-top:2mm;border-top:0.4mm solid #000;padding-top:1.5mm">
      ${showP ? `<table style="margin-left:auto"><tr><td>Ara toplam</td><td class="r" style="padding-left:6mm">${money(totals.subtotal)} ${cur}</td></tr>
        ${d.vatRate ? `<tr><td>KDV %${d.vatRate}</td><td class="r" style="padding-left:6mm">${money(totals.vat)} ${cur}</td></tr>` : ''}
        <tr><td><b>Genel toplam</b></td><td class="r" style="padding-left:6mm"><b>${money(totals.total)} ${cur}</b></td></tr></table>` : ''}
      ${d.notes ? `<div style="margin-top:1.5mm">Not: ${esc(d.notes)}</div>` : ''}
      <table style="width:100%;margin-top:8mm"><tr><td style="width:50%">Teslim eden: ..................</td><td>Teslim alan: ..................</td></tr></table>
      <div style="margin-top:3mm;font-size:0.8em">Bu belge resmî e-irsaliye yerine geçmez.</div></div>`
    : `<div style="margin-top:2mm" class="r">Devamı sonraki sayfada →</div>`}
</div>`;
}

function preprintedPage(d: DispatchPrintInput, c: PrintConfig, rows: DispatchPrintLine[], startIndex: number, last: boolean, totals: ReturnType<typeof dispatchTotals>) {
  const F = { ...DEFAULT_FIELDS, ...(c.fieldPositions ?? {}) } as Record<FieldKey, FieldPos>;
  const at = (p: FieldPos, html: string, right = false) =>
    `<div class="abs" style="${right ? `right:${c.widthMm - p.x}mm` : `left:${p.x}mm`};top:${p.y}mm">${html}</div>`;
  const out: string[] = [
    at(F.customer, esc(d.customer.name)),
    d.customer.address ? at(F.address, esc(d.customer.address)) : '',
    d.customer.taxId ? at(F.taxId, esc(d.customer.taxId)) : '',
    at(F.date, day(d.date)),
    at(F.no, esc(d.no)),
    [d.carrier, d.vehiclePlate, d.driverName].some(Boolean) ? at(F.transport, esc([d.carrier, d.vehiclePlate, d.driverName].filter(Boolean).join(' · '))) : '',
  ];
  rows.forEach((l, i) => {
    const y = F.lines.y + i * c.lineHeightMm;
    const t = totals.lineTotals[startIndex + i];
    out.push(at({ x: F.colCode.x, y }, esc(l.code)), at({ x: F.colName.x, y }, esc(l.name)),
      at({ x: F.colQty.x, y }, esc(formatQty(l.qty, l.unit).replace(/\s*\S+$/, '')), true), at({ x: F.colUnit.x, y }, esc(l.unit || 'adet')));
    if (c.showPrices) {
      if (l.unitPrice != null) out.push(at({ x: F.colPrice.x, y }, money(l.unitPrice), true));
      if (t != null) out.push(at({ x: F.colTotal.x, y }, money(t), true));
    }
  });
  if (last) {
    if (d.notes) out.push(at(F.notes, esc(d.notes)));
    if (c.showPrices) out.push(at(F.total, `${money(totals.total)} ${esc(d.currency ?? '')}`, true));
  }
  return `<div class="page">${out.join('')}</div>`;
}

/** Sevk fişi HTML'i: kopya sayısı × sayfa */
export function dispatchPrintHtml(d: DispatchPrintInput, cfg: Partial<PrintConfig> | null | undefined) {
  const c = normalizePrintConfig(cfg);
  const totals = dispatchTotals(d.lines, d.vatRate ?? 0);
  const pages = paginate(d.lines, c.maxLines);
  const one = pages.map((rows, i) => {
    const start = pages.slice(0, i).reduce((a, p) => a + p.length, 0);
    return c.mode === 'preprinted'
      ? preprintedPage(d, c, rows, start, i === pages.length - 1, totals)
      : fullPage(d, c, rows, start, i + 1, pages.length, totals);
  }).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sevk fişi ${esc(d.no)}</title><style>${baseCss(c)}
table { border-collapse: collapse; } th, td { padding: 0.6mm 1mm; vertical-align: top; }
</style></head><body>${Array.from({ length: c.copies }, () => one).join('')}</body></html>`;
}

/** Kalibrasyon sayfası: 10 mm ızgara, kenar çerçevesi ve matbu form alanlarının işaretleri */
export function calibrationHtml(cfg: Partial<PrintConfig> | null | undefined) {
  const c = normalizePrintConfig(cfg);
  const F = { ...DEFAULT_FIELDS, ...(c.fieldPositions ?? {}) } as Record<FieldKey, FieldPos>;
  const lines: string[] = [];
  for (let x = 0; x <= c.widthMm; x += 10) lines.push(`<div class="abs" style="left:${x}mm;top:0;height:${c.heightMm}mm;border-left:0.2mm solid #000;${x % 50 ? 'opacity:.35' : ''}"></div><div class="abs" style="left:${x + 0.6}mm;top:1mm;font-size:6pt">${x}</div>`);
  for (let y = 0; y <= c.heightMm; y += 10) lines.push(`<div class="abs" style="top:${y}mm;left:0;width:${c.widthMm}mm;border-top:0.2mm solid #000;${y % 50 ? 'opacity:.35' : ''}"></div><div class="abs" style="top:${y + 0.6}mm;left:1mm;font-size:6pt">${y}</div>`);
  const marks = c.mode === 'preprinted'
    ? (Object.keys(FIELD_LABELS) as FieldKey[]).filter(k => !k.startsWith('col') && k !== 'lines').map(k => (F[k].x > c.widthMm - 45
        ? `<div class="abs" style="right:${c.widthMm - F[k].x}mm;top:${F[k].y}mm;font-size:7pt">${esc(FIELD_LABELS[k])} ■</div>`
        : `<div class="abs" style="left:${F[k].x}mm;top:${F[k].y}mm;font-size:7pt">■ ${esc(FIELD_LABELS[k])}</div>`)).join('')
    : '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kalibrasyon</title><style>${baseCss(c)}</style></head><body>
<div class="page"><div class="abs" style="left:0;top:0;width:${c.widthMm}mm;height:${c.heightMm}mm;border:0.4mm solid #000"></div>${lines.join('')}${marks}
<div class="abs" style="left:${c.widthMm / 2 - 30}mm;top:${c.heightMm / 2 - 4}mm;font-size:9pt;background:#fff;padding:1mm">${c.widthMm} × ${c.heightMm} mm · 10 mm ızgara</div></div></body></html>`;
}
