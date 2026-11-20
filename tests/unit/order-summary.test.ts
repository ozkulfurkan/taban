// Siparişlerin ürün bazında özeti ve ürün föyü. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productsHtml, summarizeByProduct } from '../../lib/order-summary';
import type { PrintableOrder } from '../../lib/order-print';

const now = new Date('2026-11-22T09:00:00Z');

const orders: PrintableOrder[] = [
  // Tekli (eski biçim) sipariş: ürün sipariş kaydında
  { id: 'o1', orderNo: 'SIP-1', status: 'ORDER_RECEIVED', createdAt: '2026-11-20', totalQuantity: 30, unit: null,
    productId: 'p-taba', productCode: 'TB-205', sizeDistribution: { '40': 10, '41': 20 }, product: { id: 'p-taba', name: 'Klasik PU', code: 'TB-205' },
    customer: { name: 'Ayakkabı Dünyası' }, requestedDeliveryDate: '2026-12-10' },
  // Paket sipariş: aynı ürün iki renkte + başka ürün
  { id: 'o2', orderNo: 'SIP-2', status: 'ORDER_RECEIVED', createdAt: '2026-11-21', totalQuantity: 70, unit: null,
    orderItems: [
      { productId: 'p-taba', productCode: 'TB-205', productName: 'Klasik PU', color: 'Taba', sizeDistribution: { '40': 5, '42': 15 }, totalQuantity: 20, unit: 'çift' },
      { productId: 'p-taba', productCode: 'TB-205', productName: 'Klasik PU', color: 'Siyah', sizeDistribution: { '41': 10 }, totalQuantity: 10, unit: 'çift' },
      { productId: 'p-run', productCode: 'TB-101', productName: 'Runner', sizeDistribution: { '42': 40 }, totalQuantity: 40, unit: 'çift' },
    ],
    customer: { name: 'Yıldız Kundura' }, requestedDeliveryDate: '2026-12-01' },
  // kg siparişi (firma ağından)
  { id: 'o3', orderNo: 'ORD-3', status: 'ORDER_RECEIVED', createdAt: '2026-11-21', totalQuantity: 750.5, unit: 'kg',
    orderItems: [{ productId: 'p-tpu', productCode: 'HM-TPU85', productName: 'TPU', sizeDistribution: {}, totalQuantity: 750.5, unit: 'kg' }],
    link: { buyerCompany: { name: 'Demo Taban' } } },
];

test('aynı ürün siparişler arasında toplanır, bedenler birleşir', () => {
  const s = summarizeByProduct(orders);
  const taba = s.find(x => x.productId === 'p-taba')!;
  assert.equal(taba.totalQuantity, 60);
  assert.deepEqual(taba.sizeDistribution, { '40': 15, '41': 30, '42': 15 });
  assert.equal(taba.orderCount, 2, 'aynı siparişteki iki renk tek sipariş sayılır');
  assert.deepEqual(taba.customers, [{ name: 'Ayakkabı Dünyası', quantity: 30 }, { name: 'Yıldız Kundura', quantity: 30 }]);
  assert.equal(taba.orders.find(o => o.orderNo === 'SIP-2')!.quantity, 30);
  assert.equal(taba.earliestDue, new Date('2026-12-01').toISOString());
});

test('kg ürünü ayrı satır, ondalık korunur, firma ağı alıcısı müşteri adı', () => {
  const tpu = summarizeByProduct(orders).find(x => x.productId === 'p-tpu')!;
  assert.deepEqual([tpu.unit, tpu.totalQuantity, tpu.customers[0].name], ['kg', 750.5, 'Demo Taban']);
});

test('en çok sipariş edilen ürün üstte', () => {
  assert.equal(summarizeByProduct(orders)[0].productId, 'p-taba');
});

test('ürün kaydı olmayan satırlar kod + ada göre gruplanır', () => {
  const s = summarizeByProduct([
    { orderNo: 'A', status: 'x', createdAt: now, totalQuantity: 5, orderItems: [{ productCode: 'x-1', productName: 'Özel', totalQuantity: 5, unit: 'çift' }] },
    { orderNo: 'B', status: 'x', createdAt: now, totalQuantity: 7, orderItems: [{ productCode: 'X-1', productName: 'özel', totalQuantity: 7, unit: 'çift' }] },
  ]);
  assert.equal(s.length, 1);
  assert.equal(s[0].totalQuantity, 12);
});

test('ürün föyü: beden tablosu, sipariş dökümü, birim toplamları, kaçış', () => {
  const html = productsHtml(summarizeByProduct(orders), { title: 'Bekleyen siparişler — ürün bazında', now });
  assert.match(html, /3 ürün · 100 çift \+ 750,5 kg/);
  assert.match(html, /TB-205 · Klasik PU/);
  assert.match(html, /En yakın termin: <b>01\.12\.2026<\/b>/);
  assert.match(html, /SIP-2<\/td><td>Yıldız Kundura/);
  assert.match(html, /— ürün bazında/);
  assert.match(productsHtml([], { title: 't', now }), /Sipariş yok\./);
});
