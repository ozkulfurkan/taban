// Koli etiketi: numara/adet dağılımından koli listesi ve yazdırılacak etiket HTML'i.
// Saf modül (sunucu ve tarayıcı): barkod SVG'leri çağıran taraf üretip verir; dışarıdan kütüphane yüklenmez.

export type KoliMode = 'single' | 'mixed';
/** single (tabancı): her satır kendi kolisi; "37 No · 40 çift" × koli sayısı. mixed (ayakkabıcı): tüm numaralar tek kolide. */
export type KoliRow = { size: string; qty: number; boxes?: number };
export type KoliBox = { sizes: Record<string, number>; totalQuantity: number; boxIndex: number; boxCount: number };

export const MAX_KOLI_LABELS = 500;
const MAX_QTY = 100_000;

const sizeKey = (s: string) => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};
/** Numaraları sayısal sıraya dizer (36, 36.5, 37 … sonra sayı olmayanlar) */
export function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => sizeKey(a) - sizeKey(b) || a.localeCompare(b, 'tr'));
}

const cleanInt = (v: unknown, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};
const cleanSize = (v: unknown) => String(v ?? '').trim().slice(0, 10);

/** Girdiyi koli listesine çevirir. Geçersiz/boş satırlar atlanır; toplam etiket sınırı aşılırsa hata döner. */
export function planBoxes(mode: KoliMode, rows: unknown, boxCount: unknown = 1): { boxes: KoliBox[] } | { error: string } {
  const list: KoliRow[] = (Array.isArray(rows) ? rows : [])
    .map((r: any) => ({ size: cleanSize(r?.size), qty: cleanInt(r?.qty, MAX_QTY), boxes: cleanInt(r?.boxes ?? 1, MAX_KOLI_LABELS) || 1 }))
    .filter(r => r.size && r.qty > 0);
  if (!list.length) return { error: 'En az bir numaraya adet girin' };

  const boxes: KoliBox[] = [];
  if (mode === 'single') {
    const total = list.reduce((a, r) => a + (r.boxes ?? 1), 0);
    if (total > MAX_KOLI_LABELS) return { error: `Tek seferde en fazla ${MAX_KOLI_LABELS} koli etiketi basılabilir` };
    for (const r of sortSizesRows(list)) {
      const n = r.boxes ?? 1;
      for (let i = 1; i <= n; i++) boxes.push({ sizes: { [r.size]: r.qty }, totalQuantity: r.qty, boxIndex: i, boxCount: n });
    }
  } else {
    const n = cleanInt(boxCount, MAX_KOLI_LABELS + 1) || 1;
    if (n > MAX_KOLI_LABELS) return { error: `Tek seferde en fazla ${MAX_KOLI_LABELS} koli etiketi basılabilir` };
    const sizes: Record<string, number> = {};
    for (const r of sortSizesRows(list)) sizes[r.size] = (sizes[r.size] ?? 0) + r.qty;
    const totalQuantity = Object.values(sizes).reduce((a, b) => a + b, 0);
    for (let i = 1; i <= n; i++) boxes.push({ sizes, totalQuantity, boxIndex: i, boxCount: n });
  }
  return { boxes };
}
function sortSizesRows(rows: KoliRow[]) {
  const order = sortSizes(rows.map(r => r.size));
  return [...rows].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
}

/** Barkod numarası: K + yymmdd + "-" + 4 haneli sıra (örn. K261124-0007) */
export function koliBarcode(date: Date, seq: number) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `K${yy}${mm}${dd}-${String(seq).padStart(4, '0')}`;
}
export const koliSequenceKey = (date: Date) => `koli-${koliBarcode(date, 0).slice(1, 7)}`;

// ── Etiket HTML'i
export type KoliLabel = {
  barcode: string; productCode?: string | null; productName: string; color?: string | null;
  customerName?: string | null; orderNo?: string | null; unit: string;
  sizes: Record<string, number>; totalQuantity: number; boxIndex: number; boxCount: number;
};
export type KoliLabelOptions = {
  companyName: string; logoUrl?: string | null; date: string;
  width: number; height: number; padding?: number;
  /** barkod → SVG işaretlemesi (çağıran üretir) */
  barcodeSvg: Record<string, string>;
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
// Yalnızca gömülü görsel veri adresi (dış adres yazdırma penceresine sızmasın)
const safeImg = (src?: string | null) => (src && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : null);
// SVG yalnızca beklenen biçimdeyse kullanılır (barkod kütüphanesinin ürettiği <svg …>…</svg>)
const safeSvg = (svg?: string) => (svg && /^<svg[\s>]/.test(svg) && !/<script|on\w+=|javascript:/i.test(svg) ? svg : '');

export function koliLabelHtml(labels: KoliLabel[], o: KoliLabelOptions) {
  const W = o.width, H = o.height, P = o.padding ?? 3;
  const k = Math.min(W / 100, H / 60); // yazı ölçeği (100×60 mm = 1)
  const pt = (n: number) => `${(n * k).toFixed(1)}pt`;
  const logo = safeImg(o.logoUrl);

  const body = labels.map((l, i) => {
    const entries = Object.entries(l.sizes);
    const single = entries.length === 1;
    const sizeBlock = single
      ? `<div class="single"><span class="no">${esc(entries[0][0])}</span><span class="nol">No</span><span class="x">×</span><span class="q">${esc(entries[0][1])}</span><span class="u">${esc(l.unit)}</span></div>`
      : `<table class="grid"><tr><th>No</th>${entries.map(([s]) => `<th>${esc(s)}</th>`).join('')}</tr>
          <tr><td>Adet</td>${entries.map(([, q]) => `<td>${esc(q)}</td>`).join('')}</tr></table>`;
    const meta = [l.customerName ? `<b>${esc(l.customerName)}</b>` : '', l.orderNo ? esc(l.orderNo) : ''].filter(Boolean).join(' · ');
    return `<section class="label"${i === labels.length - 1 ? '' : ' style="page-break-after:always"'}>
  <header>${logo ? `<img src="${logo}" alt="">` : ''}<span class="co">${esc(o.companyName)}</span><span class="date">${esc(o.date)}</span></header>
  <div class="prod">${l.productCode ? `<span class="code">${esc(l.productCode)}</span> ` : ''}${esc(l.productName)}${l.color ? ` <span class="color">· ${esc(l.color)}</span>` : ''}</div>
  ${meta ? `<div class="meta">${meta}</div>` : ''}
  ${sizeBlock}
  <div class="foot"><span class="total">Toplam ${esc(l.totalQuantity)} ${esc(l.unit)}</span><span class="box">Koli ${l.boxIndex}/${l.boxCount}</span></div>
  <div class="bc">${safeSvg(o.barcodeSvg[l.barcode])}<div class="bcn">${esc(l.barcode)}</div></div>
</section>`;
  }).join('\n');

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Koli etiketi</title><style>
@page { size: ${W}mm ${H}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; }
.label { width: ${W}mm; height: ${H}mm; padding: ${P}mm; display: flex; flex-direction: column; gap: ${(1.2 * k).toFixed(2)}mm; overflow: hidden; }
header { display: flex; align-items: center; gap: 2mm; font-size: ${pt(7)}; border-bottom: 0.3mm solid #000; padding-bottom: 1mm; }
header img { max-height: ${(6 * k).toFixed(1)}mm; max-width: 20mm; object-fit: contain; }
header .co { font-weight: bold; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
header .date { white-space: nowrap; }
.prod { font-size: ${pt(10)}; font-weight: bold; line-height: 1.15; }
.prod .code { font-family: 'Courier New', monospace; }
.prod .color { font-weight: normal; }
.meta { font-size: ${pt(8)}; line-height: 1.2; }
.grid { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: ${pt(8)}; text-align: center; }
.grid th, .grid td { border: 0.25mm solid #000; padding: 0.6mm 0; }
.grid th { font-weight: bold; background: #eee; }
.grid td { font-size: ${pt(9.5)}; font-weight: bold; }
.grid th:first-child, .grid td:first-child { width: 11mm; font-size: ${pt(6.5)}; font-weight: normal; }
.single { display: flex; align-items: baseline; justify-content: center; gap: 1.5mm; line-height: 1; }
.single .no, .single .q { font-size: ${pt(24)}; font-weight: bold; }
.single .nol, .single .u { font-size: ${pt(10)}; }
.single .x { font-size: ${pt(14)}; }
.foot { display: flex; justify-content: space-between; align-items: baseline; }
.foot .total { font-size: ${pt(11)}; font-weight: bold; }
.foot .box { font-size: ${pt(8)}; }
.bc { margin-top: auto; text-align: center; }
.bc svg { display: block; margin: 0 auto; max-width: 100%; height: ${(11 * k).toFixed(1)}mm; }
.bcn { font-family: 'Courier New', monospace; font-size: ${pt(7.5)}; letter-spacing: 0.5px; }
</style></head><body>
${body}
</body></html>`;
}
