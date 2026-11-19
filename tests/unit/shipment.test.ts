// Sevk edilen miktar: sipariş ile fark, doğrulama. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShipped, formatDiff, shipDiff, shipLines } from '../../lib/shipment';

const order = {
  unit: 'kg', totalQuantity: 750,
  orderItems: [
    { productId: 'a', productCode: 'PVC', productName: 'PVC', unit: 'kg', totalQuantity: 500 },
    { productId: 'b', productCode: 'TPR', productName: 'TPR', unit: 'kg', totalQuantity: 250 },
  ],
};

test('satırlar: paket siparişte kalem başına, tekli siparişte tek satır', () => {
  assert.deepEqual(shipLines(order).map(l => [l.index, l.productCode, l.ordered, l.unit]), [[0, 'PVC', 500, 'kg'], [1, 'TPR', 250, 'kg']]);
  assert.deepEqual(shipLines({ totalQuantity: 36, productCode: 'TB' }).map(l => [l.ordered, l.unit]), [[36, 'çift']]);
});

test('sevk miktarı: az/çok sevk, boş = sipariş miktarı, 0 = sevk edilmedi', () => {
  const r = buildShipped(shipLines(order), { 0: 490, 1: '' });
  assert.ok(!('error' in r));
  assert.deepEqual(r.items.map(i => i.shipped), [490, 250]);
  assert.equal(r.total, 740);
  const over = buildShipped(shipLines(order), { 0: '520,5', 1: 0 });
  assert.ok(!('error' in over));
  assert.deepEqual(over.items.map(i => i.shipped), [520.5, 0]);
  assert.ok('error' in buildShipped(shipLines(order), { 0: -5 }));
  assert.ok('error' in buildShipped(shipLines(order), { 0: 0, 1: 0 }));
  assert.ok('error' in buildShipped(shipLines({ unit: 'adet', totalQuantity: 10 }), { 0: 2.5 }));
});

test('fark gösterimi', () => {
  assert.deepEqual(shipDiff(500, 490), { diff: -10, pct: -2 });
  assert.equal(formatDiff(500, 490, 'kg'), '−10 kg (%2)');
  assert.equal(formatDiff(500, 520, 'kg'), '+20 kg (%4)');
  assert.equal(formatDiff(500, 500, 'kg'), '');
  assert.equal(formatDiff(1250.5, 1250, 'kg'), '−0,5 kg');
});
