// Sipariş birimleri: çift asortiyle, diğerleri miktarla. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuantity, formatQty, isPairUnit, orderUnit, unitDecimals } from '../../lib/order-units';

test('çift birimi (ve boş birim) asortiyle sipariş edilir', () => {
  assert.equal(isPairUnit('çift'), true);
  assert.equal(isPairUnit(null), true);
  assert.equal(isPairUnit('Çift'), true);
  assert.equal(isPairUnit('kg'), false);
  assert.equal(orderUnit(undefined), 'çift');
  assert.equal(orderUnit('metre'), 'metre');
});

test('miktar: kg/ton/lt/metre 3 ondalık, adet/paket tam sayı', () => {
  assert.equal(unitDecimals('kg'), 3);
  assert.equal(unitDecimals('adet'), 0);
  assert.equal(cleanQuantity(1250.5, 'kg'), 1250.5);
  assert.equal(cleanQuantity('1.250,5', 'kg'), 1250.5);
  assert.equal(cleanQuantity(0.12345, 'metre'), 0.123);
  assert.equal(cleanQuantity(2.5, 'adet'), null);
  assert.equal(cleanQuantity(40, 'paket'), 40);
  assert.equal(cleanQuantity(0, 'kg'), null);
  assert.equal(cleanQuantity(-3, 'kg'), null);
  assert.equal(cleanQuantity('abc', 'kg'), null);
  assert.equal(cleanQuantity(0.0001, 'kg'), null);
});

test('gösterim birimle', () => {
  assert.equal(formatQty(1250.5, 'kg'), '1.250,5 kg');
  assert.equal(formatQty(36, null), '36 çift');
});

test('üretim emri e-postası: hammadde kalemleri miktarla, taban asortiyle; HTML kaçışlı', async () => {
  const { itemsTableHtml } = await import('../../lib/order-email');
  const kg = itemsTableHtml([
    { productCode: 'PVC-01', productName: 'PVC Granül', unit: 'kg', color: '', sizeDistribution: {}, totalQuantity: 1000 },
    { productCode: 'TPR-02', productName: 'TPR <Granül>', unit: 'kg', color: 'Siyah', sizeDistribution: {}, totalQuantity: 250.5 },
  ]);
  assert.match(kg, /PVC-01/);
  assert.match(kg, /1\.000 kg/);
  assert.match(kg, /250,5 kg/);
  assert.match(kg, /TPR &lt;Granül&gt;/);
  assert.doesNotMatch(kg, /Beden Dağılımı/);
  const pair = itemsTableHtml([{ productCode: 'TB-1', productName: 'Taban', unit: 'çift', color: 'Beyaz', sizeDistribution: { '40': 24, '38': 12 }, totalQuantity: 36 }]);
  assert.match(pair, /Beden Dağılımı/);
  assert.match(pair, /38×12 · 40×24/);
  assert.match(pair, /36 çift/);
});
