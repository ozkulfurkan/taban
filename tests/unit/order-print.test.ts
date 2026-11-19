// Sipariş föyü (web ve mobil ortak HTML). Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordersHtml, printLines, type PrintableOrder } from '../../lib/order-print';

const now = new Date('2026-11-19T09:00:00Z');

const pairOrder: PrintableOrder = {
  orderNo: 'SIP-2026-0001', status: 'ORDER_RECEIVED', createdAt: '2026-11-18T08:00:00Z', totalQuantity: 30, unit: null,
  requestedDeliveryDate: '2026-12-01T00:00:00Z', notes: 'Acil <kalıp>',
  productCode: 'TB-205', color: 'Taba', sizeDistribution: { '41': 10, '39': 5, '40': 15 },
  product: { name: 'Klasik PU', code: 'TB-205' }, customer: { name: 'Ayakkabı Dünyası' },
};

const kgOrder: PrintableOrder = {
  orderNo: 'ORD-20261119-1932', status: 'IN_PRODUCTION', createdAt: '2026-11-19T08:00:00Z', totalQuantity: 2250.5, unit: 'kg',
  orderItems: [
    { productCode: 'HM-PU60', productName: 'PU Sistemi', totalQuantity: 1500, unit: 'kg', sizeDistribution: {} },
    { productCode: 'HM-TPU85', productName: 'TPU Granül', totalQuantity: 750.5, unit: 'kg', sizeDistribution: {} },
  ],
  link: { buyerCompany: { name: 'Demo Taban' } },
};

test('tekli sipariş tek satıra çevrilir', () => {
  const lines = printLines(pairOrder);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productName, 'Klasik PU');
  assert.equal(lines[0].unit, 'çift');
});

test('beden sütunları sıralı, toplam ve termin görünür', () => {
  const html = ordersHtml([pairOrder], { title: 'Bekleyen siparişler', companyName: 'Demo', now });
  const heads = Array.from(html.matchAll(/<th class="n">([^<]+)<\/th>/g)).map(m => m[1]);
  assert.deepEqual(heads, ['39', '40', '41', 'Toplam']);
  assert.match(html, /30 çift/);
  assert.match(html, /Termin: <b>01\.12\.2026<\/b>/);
  assert.match(html, /1 sipariş · 30 çift/);
});

test('kg siparişinde beden sütunu yok, ondalık miktar korunur, firma ağı alıcısı müşteri olarak yazılır', () => {
  const html = ordersHtml([kgOrder], { title: 'Siparişler', now });
  assert.doesNotMatch(html, /<th class="n">\d/);
  assert.match(html, /750,5 kg/);
  assert.match(html, /Demo Taban/);
});

test('farklı birimler özet satırında ayrı toplanır', () => {
  const html = ordersHtml([pairOrder, kgOrder], { title: 'Siparişler', now });
  assert.match(html, /2 sipariş · 30 çift \+ 2\.250,5 kg/);
});

test('metin kaçışlanır (not alanındaki HTML çalışmaz)', () => {
  const html = ordersHtml([pairOrder], { title: '<b>x</b>', now });
  assert.match(html, /Acil &lt;kalıp&gt;/);
  assert.doesNotMatch(html, /<title><b>/);
});

test('boş listede "Sipariş yok"', () => {
  assert.match(ordersHtml([], { title: 'Bekleyen', now }), /Sipariş yok\./);
});
