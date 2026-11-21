import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogHtml, type CatalogProduct } from '../src/core/catalog-html';

const company = { name: 'Demo <Taban>', logoUrl: null, phone: '0212 555', address: null };
const p = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: '1', code: 'TB-101', name: 'Klasik Taban', description: null, unit: 'çift', unitPrice: 125.5, currency: 'TRY',
  category: 'Erkek', image: 'data:image/jpeg;base64,AAAA', ...over,
});
const opts = { title: 'Kış Kataloğu', showPrices: true, date: new Date(2026, 10, 20) };

test('ürünler, görsel ve altta SoleCost notu', () => {
  const html = catalogHtml(company, [p(), p({ id: '2', code: null, name: 'İkinci', image: null })], { ...opts, customerName: 'Ayakkabı Dünyası' });
  assert.match(html, /Kış Kataloğu/);
  assert.match(html, /Sayın Ayakkabı Dünyası/);
  assert.match(html, /<img src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /125,50 TRY/);
  assert.match(html, /2 ürün/);
  assert.match(html, /<b>SoleCost<\/b> tarafından üretilmiştir<\/div>\s*<\/body>/);
});

test('fiyat gizlenebilir', () => {
  const html = catalogHtml(company, [p()], { ...opts, showPrices: false });
  assert.doesNotMatch(html, /125,50/);
  assert.match(html, /Fiyat için bizimle iletişime geçin/);
});

test('metin kaçışlanır, yalnızca gömülü görsel kabul edilir', () => {
  const html = catalogHtml(company, [p({ name: '<script>x</script>', image: 'https://evil.test/a.png' })], opts);
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /Demo &lt;Taban&gt;/);
  assert.doesNotMatch(html, /evil\.test/);
});

test('sayfa sonunda bölünmesin: ürünler ikişerli bölünmez satırlarda, grid/flex kart yok', () => {
  const html = catalogHtml(company, [p({ id: '1' }), p({ id: '2' }), p({ id: '3' })], opts);
  assert.equal((html.match(/<div class="row">/g) ?? []).length, 2);
  assert.match(html, /\.row \{ display: block; page-break-inside: avoid; break-inside: avoid;/);
  assert.doesNotMatch(html, /display: grid/);
  assert.doesNotMatch(html, /\.card \{[^}]*display: flex/);
  assert.equal((html.match(/class="card last"/g) ?? []).length, 1);
});
