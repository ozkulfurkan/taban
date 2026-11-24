// Portal sipariş süreci: durum geçişleri, kalan sevk hesabı ve irsaliye HTML'i. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isForwardStatus, nextStatuses, statusTransitionError } from '../../lib/order-status';
import { remainingLines, shippedSoFar } from '../../lib/shipment';
import { deliveryNoteHtml } from '../../lib/delivery-note-html';

test('durum geçişleri: ileri serbest, geri bir adım, sevk son, iptal yalnızca geri alınır', () => {
  assert.equal(statusTransitionError('ORDER_RECEIVED', 'PACKAGING'), null);
  assert.equal(statusTransitionError('PACKAGING', 'PAINTING'), null);
  assert.ok(statusTransitionError('PACKAGING', 'ORDER_RECEIVED'));
  assert.ok(statusTransitionError('SHIPPED', 'READY_FOR_SHIPMENT'));
  assert.ok(statusTransitionError('SHIPPED', 'CANCELLED'));
  assert.ok(statusTransitionError('CANCELLED', 'IN_PRODUCTION'));
  assert.equal(statusTransitionError('CANCELLED', 'ORDER_RECEIVED'), null);
  assert.equal(statusTransitionError('IN_PRODUCTION', 'CANCELLED'), null);
  assert.ok(statusTransitionError('ORDER_RECEIVED', 'YOK'));
  assert.equal(isForwardStatus('IN_PRODUCTION', 'MOLDING'), true);
  assert.equal(isForwardStatus('MOLDING', 'IN_PRODUCTION'), false);
});

test('durum listesi yalnızca geçerli adımları içerir', () => {
  const keys = (from: string, unit?: string) => nextStatuses(from, unit).map(s => s.key);
  assert.ok(!keys('PACKAGING').includes('ORDER_RECEIVED'));
  assert.ok(keys('PACKAGING').includes('SHIPPED'));
  assert.deepEqual(keys('SHIPPED'), ['SHIPPED']);
  assert.deepEqual(keys('CANCELLED'), ['ORDER_RECEIVED']);
  // Hammadde (kg) siparişinde üretim alt adımları yok
  assert.ok(!keys('ORDER_RECEIVED', 'kg').includes('MOLDING'));
});

test('kalan sevk: önceki sevkiyatlar düşülür, eksiye inmez', () => {
  const lines = [{ index: 0, ordered: 1000, unit: 'kg' }, { index: 1, ordered: 250.5, unit: 'kg' }] as any;
  const prior = shippedSoFar([{ items: [{ index: 0, shipped: 600 }] }, { items: [{ index: 0, shipped: 500 }, { index: 1, shipped: 100.25 }] }, { items: null }]);
  assert.deepEqual(prior, { 0: 1100, 1: 100.25 });
  assert.deepEqual(remainingLines(lines, prior).map(l => l.remaining), [0, 150.25]);
});

test('irsaliye HTML: değerler kaçışlanır, sıra ve toplam yazılır', () => {
  const html = deliveryNoteHtml({
    company: { name: 'A&B <Taban>', logoUrl: 'javascript:alert(1)' },
    customer: { name: '"Müşteri" <script>x</script>' },
    orderNo: 'SIP-2026-0001',
    shipment: { shipmentDate: '2026-11-25', deliveryNoteNo: 'IRS-1', notes: '<img src=x onerror=1>' },
    lines: [{ productCode: 'T-1', unit: 'çift', ordered: 20, shipped: 12 }, { productCode: 'T-2', unit: 'çift', ordered: 5, shipped: 5 }],
    sequence: { index: 1, count: 2 },
  });
  assert.ok(html.includes('A&amp;B &lt;Taban&gt;'));
  assert.ok(!html.includes('<script>x'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('1. sevkiyat / 2'));
  assert.ok(html.includes('17 çift'));
  assert.ok(html.includes('resmî e-irsaliye yerine geçmez'));
});
