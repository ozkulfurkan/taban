// Ürün kataloğu PDF'i (HTML → web'de yazdır / PDF olarak kaydet, mobilde expo-print). Saf modül: web ve mobil (@shared/catalog-html).

export type CatalogProduct = {
  id: string; code: string | null; name: string; description: string | null; unit: string | null;
  unitPrice: number; currency: string; sizes?: string[]; renk?: string | null; shore?: string | null;
  category: string | null; image: string | null;
};
export type CatalogCompany = { name: string; logoUrl: string | null; phone: string | null; address: string | null; taxId?: string | null };
export type CatalogOptions = { title: string; customerName?: string; showPrices: boolean; date: Date };

export const FOOTER_TEXT = 'SoleCost tarafından üretilmiştir';

const BRAND = '#6B1A2C';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
// Yalnızca gömülü görsel veri adresi kabul edilir (dış adres PDF'e sızmasın)
const safeImg = (src: string | null | undefined) => (src && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : null);

export function formatPrice(n: number, currency: string) {
  const v = n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency}`;
}

function card(p: CatalogProduct, showPrices: boolean, last = false) {
  const img = safeImg(p.image);
  const meta = [p.category, p.renk ? `Renk: ${p.renk}` : null, p.shore ? `Shore: ${p.shore}` : null].filter(Boolean).join(' · ');
  const sizes = p.sizes?.length ? `Numara: ${p.sizes.join(', ')}` : '';
  return `
    <div class="card${last ? ' last' : ''}">
      <div class="img">${img ? `<img src="${img}" alt="">` : `<div class="noimg">${esc((p.code || p.name).slice(0, 2).toLocaleUpperCase('tr-TR'))}</div>`}</div>
      <div class="body">
        ${p.code ? `<div class="code">${esc(p.code)}</div>` : ''}
        <div class="name">${esc(p.name)}</div>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
        ${sizes ? `<div class="meta">${esc(sizes)}</div>` : ''}
        ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
        ${showPrices && p.unitPrice > 0 ? `<div class="price">${esc(formatPrice(p.unitPrice, p.currency))}<span> / ${esc(p.unit || 'çift')}</span></div>` : ''}
      </div>
    </div>`;
}

/** Ürünleri ikişerli satırlara böler (her satır sayfada bölünmeden tek parça basılır) */
export function rows<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

export function catalogHtml(company: CatalogCompany, products: CatalogProduct[], o: CatalogOptions) {
  const logo = safeImg(company.logoUrl);
  const contact = [company.phone, company.address].filter(Boolean).map(esc).join(' · ');
  const date = o.date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
  @page { margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1F1418; margin: 0; font-size: 11px; }
  .head { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; border-bottom: 3px solid ${BRAND}; }
  .head img { height: 48px; max-width: 140px; object-fit: contain; }
  .mono { width: 48px; height: 48px; border-radius: 12px; background: ${BRAND}; color: #fff; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .co { flex: 1; } .co b { font-size: 16px; display: block; } .co span { color: #6B5B60; }
  .title { margin: 16px 0 4px; font-size: 22px; font-weight: 800; color: ${BRAND}; }
  .sub { color: #6B5B60; margin-bottom: 14px; }
  /* Yazdırmada (iOS WebKit) grid/flex öğeleri sayfa sonunda bölünüyor: ürünler ikişerli,
     bölünmez blok satırlara dizilir; kartlar inline-block olur. */
  .row { display: block; page-break-inside: avoid; break-inside: avoid; margin-bottom: 12px; white-space: nowrap; font-size: 0; }
  .card { display: inline-block; vertical-align: top; width: 49%; margin-right: 2%; white-space: normal; font-size: 11px;
    border: 1px solid #EDE2E5; border-radius: 12px; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  .card.last { margin-right: 0; }
  .img { display: block; height: 190px; background: #FAF6F6; text-align: center; overflow: hidden; }
  .img img { display: block; width: 100%; height: 190px; object-fit: cover; }
  .noimg { line-height: 190px; font-size: 34px; font-weight: 800; color: #D9C4CA; }
  .body { padding: 10px 12px 12px; }
  .code { color: ${BRAND}; font-weight: 700; font-size: 10px; letter-spacing: .5px; }
  .name { font-size: 13px; font-weight: 700; margin: 2px 0 4px; }
  .meta { color: #6B5B60; font-size: 10px; }
  .desc { margin-top: 4px; color: #3A2C31; }
  .price { margin-top: 8px; font-size: 14px; font-weight: 800; color: ${BRAND}; } .price span { font-size: 10px; font-weight: 500; color: #6B5B60; }
  .foot { margin-top: 22px; padding-top: 10px; border-top: 1px solid #EDE2E5; text-align: center; color: #9A8A90; font-size: 10px; }
  .foot b { color: ${BRAND}; }
</style></head><body>
  <div class="head">
    ${logo ? `<img src="${logo}" alt="">` : `<div class="mono">${esc(company.name.slice(0, 1).toLocaleUpperCase('tr-TR'))}</div>`}
    <div class="co"><b>${esc(company.name)}</b>${contact ? `<span>${contact}</span>` : ''}</div>
  </div>
  <div class="title">${esc(o.title || 'Ürün Kataloğu')}</div>
  <div class="sub">${o.customerName ? `Sayın ${esc(o.customerName)} · ` : ''}${date} · ${products.length} ürün${o.showPrices ? '' : ' · Fiyat için bizimle iletişime geçin'}</div>
  ${rows(products).map(r => `<div class="row">${r.map((p, i) => card(p, o.showPrices, i === 1)).join('')}</div>`).join('')}
  <div class="foot">Bu katalog <b>SoleCost</b> tarafından üretilmiştir</div>
</body></html>`;
}
