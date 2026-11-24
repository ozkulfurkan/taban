// Koli etiketi: kolilere bölme, barkod biçimi ve etiket HTML'i. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_KOLI_LABELS, koliBarcode, koliLabelHtml, koliSequenceKey, planBoxes, sortSizes } from '../../lib/koli';

test('numaralar sayısal sıraya dizilir', () => {
  assert.deepEqual(sortSizes(['40', '36', '38.5', '38', 'XL', '9']), ['9', '36', '38', '38.5', '40', 'XL']);
});

test('tek numara koli (tabancı): her satır kendi kolisi, koli sırası numara içinde', () => {
  const r = planBoxes('single', [{ size: '38', qty: 40, boxes: 1 }, { size: '37', qty: 40, boxes: 2 }, { size: '39', qty: 0, boxes: 3 }]);
  assert.ok('boxes' in r);
  assert.deepEqual(r.boxes.map(b => [Object.keys(b.sizes)[0], b.totalQuantity, b.boxIndex, b.boxCount]), [
    ['37', 40, 1, 2], ['37', 40, 2, 2], ['38', 40, 1, 1],
  ]);
});

test('asorti koli (ayakkabıcı): numaralar tek kolide, koli sayısı kadar etiket', () => {
  const r = planBoxes('mixed', [{ size: '38', qty: '2' }, { size: '36', qty: 1 }, { size: '37', qty: 2 }, { size: '40', qty: '' }], 3);
  assert.ok('boxes' in r);
  assert.equal(r.boxes.length, 3);
  assert.deepEqual(Object.entries(r.boxes[0].sizes), [['36', 1], ['37', 2], ['38', 2]]);
  assert.equal(r.boxes[0].totalQuantity, 5);
  assert.deepEqual(r.boxes.map(b => `${b.boxIndex}/${b.boxCount}`), ['1/3', '2/3', '3/3']);
});

test('geçersiz girdi: adet yoksa ve etiket sınırı aşılırsa hata', () => {
  assert.ok('error' in planBoxes('mixed', [{ size: '37', qty: 0 }]));
  assert.ok('error' in planBoxes('single', 'x'));
  assert.ok('error' in planBoxes('mixed', [{ size: '37', qty: 1 }], MAX_KOLI_LABELS + 1));
  assert.ok('error' in planBoxes('single', [{ size: '37', qty: 1, boxes: 300 }, { size: '38', qty: 1, boxes: 300 }]));
  assert.ok('boxes' in planBoxes('single', [{ size: '37', qty: 1, boxes: MAX_KOLI_LABELS }]));
});

test('barkod biçimi ve günlük sıra anahtarı', () => {
  const d = new Date(2026, 10, 24);
  assert.equal(koliBarcode(d, 7), 'K261124-0007');
  assert.equal(koliSequenceKey(d), 'koli-261124');
});

test('etiket HTML: içerik, kaçış ve yalnızca güvenli SVG', () => {
  const html = koliLabelHtml([
    { barcode: 'K261124-0001', productCode: 'TB-1', productName: '<b>Taban</b>', color: 'Siyah', customerName: 'A&B Ayakkabı', orderNo: 'SIP-1', unit: 'çift', sizes: { '37': 40 }, totalQuantity: 40, boxIndex: 1, boxCount: 2 },
    { barcode: 'K261124-0002', productName: 'Taban', unit: 'çift', sizes: { '36': 1, '37': 2 }, totalQuantity: 3, boxIndex: 1, boxCount: 1 },
  ], {
    companyName: 'Firma', date: '24.11.2026', width: 100, height: 75,
    barcodeSvg: { 'K261124-0001': '<svg width="10"><rect/></svg>', 'K261124-0002': '<svg onload="alert(1)"></svg>' },
  });
  assert.match(html, /@page \{ size: 100mm 75mm/);
  assert.match(html, /&lt;b&gt;Taban&lt;\/b&gt;/);
  assert.match(html, /A&amp;B Ayakkabı/);
  assert.match(html, /<span class="no">37<\/span>/);
  assert.match(html, /Koli 1\/2/);
  assert.match(html, /<th>36<\/th><th>37<\/th>/);
  assert.match(html, /<svg width="10"><rect\/><\/svg>/);
  assert.doesNotMatch(html, /onload/);
  assert.doesNotMatch(html, /<script/);
});
