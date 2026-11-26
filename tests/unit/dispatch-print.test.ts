// Sevk fişi şablonu: kâğıt ölçüsü, sayfa bölme, toplamlar, fiyat gizleme, matbu form ve kaçış. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrationHtml, dispatchPrintHtml, dispatchTotals, normalizePrintConfig, paginate } from '../../lib/dispatch-print-html';
import { convertCurrency } from '../../lib/dispatch-prices';

const input = (n: number, price: number | null = 10) => ({
  company: { name: 'Firma <A&B>' }, customer: { name: '"Müşteri" <script>x</script>' }, no: 'SVK-2026-0001', date: '2026-12-01',
  vatRate: 20, currency: 'TRY',
  lines: Array.from({ length: n }, (_, i) => ({ code: `K${i + 1}`, name: `Ürün ${i + 1}`, unit: 'çift', qty: 2, unitPrice: price })),
});

test('kâğıt ölçüsü: hazır ölçü ayarı ezer, özel ölçü ve sınırlar uygulanır', () => {
  assert.deepEqual([normalizePrintConfig({ paper: 'CF240x140', widthMm: 10 }).widthMm, normalizePrintConfig({ paper: 'CF240x140' }).heightMm], [240, 140]);
  const c = normalizePrintConfig({ paper: 'CUSTOM', widthMm: 9999, heightMm: 120, fontSizePt: 1, copies: 0 });
  assert.deepEqual([c.widthMm, c.heightMm, c.fontSizePt, c.copies], [420, 120, 6, 1]);
  assert.match(dispatchPrintHtml(input(1), { paper: 'CF240x140' }), /@page \{ size: 240mm 140mm/);
});

test('toplamlar: fiyatı olmayan satır toplama girmez ve işaretlenir', () => {
  const t = dispatchTotals([{ name: 'a', qty: 3, unitPrice: 10 }, { name: 'b', qty: 2, unitPrice: null }], 20);
  assert.deepEqual([t.subtotal, t.vat, t.total, t.missingPrice], [30, 6, 36, true]);
});

test('sayfa bölme ve kopya: 45 kalem / 20 → 3 sayfa, 2 kopya → 6 sayfa', () => {
  assert.equal(paginate([...Array(45)], 20).length, 3);
  const html = dispatchPrintHtml(input(45), { maxLines: 20, copies: 2 });
  assert.equal((html.match(/class="page"/g) ?? []).length, 6);
  assert.match(html, /Sayfa 1\/3/);
});

test('fiyat gösterimi kapalıyken fiyat ve tutar basılmaz', () => {
  const off = dispatchPrintHtml(input(2, 95), { showPrices: false });
  assert.ok(!off.includes('95,00') && !off.includes('Genel toplam'));
  const on = dispatchPrintHtml(input(2, 95), { showPrices: true });
  assert.ok(on.includes('95,00') && on.includes('Genel toplam') && on.includes('456,00')); // 2×2×95=380 + %20
});

test('matbu form: değerler verilen mm konumlarına basılır; başlık ve tablo basılmaz', () => {
  const html = dispatchPrintHtml(input(1), { mode: 'preprinted', fieldPositions: { customer: { x: 33, y: 44 } } });
  assert.match(html, /left:33mm;top:44mm">&quot;Müşteri&quot;/);
  assert.ok(!html.includes('SEVK FİŞİ'));
});

test('kaçış: firma ve müşteri adı HTML olarak çalışmaz', () => {
  const html = dispatchPrintHtml(input(1), {});
  assert.ok(html.includes('Firma &lt;A&amp;B&gt;') && !html.includes('<script>x'));
  assert.match(calibrationHtml({ paper: 'A5' }), /148 × 210 mm/);
});

test('kur çevirisi: USD → TRY ve TRY → EUR', () => {
  const r = { usdToTry: 40, eurToTry: 45 };
  assert.equal(convertCurrency(2.5, 'USD', 'TRY', r), 100);
  assert.equal(convertCurrency(90, 'TRY', 'EUR', r), 2);
  assert.ok(Number.isNaN(convertCurrency(1, 'GBP', 'TRY', r)));
});
