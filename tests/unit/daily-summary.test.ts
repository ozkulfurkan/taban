import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryHtml, trDayStart, type DailySummary } from '../../lib/daily-summary';

test('Türkiye günü UTC+3 ile hesaplanır', () => {
  // 21.11.2026 01:30 TR = 20.11.2026 22:30 UTC → TR günü 21.11, başlangıcı 20.11 21:00 UTC
  const now = new Date('2026-11-20T22:30:00Z');
  assert.equal(trDayStart(now).toISOString(), '2026-11-20T21:00:00.000Z');
  assert.equal(trDayStart(now, -1).toISOString(), '2026-11-19T21:00:00.000Z');
});

test('özet HTML: siparişler, hesaplar, toplamlar ve kapatma bağlantısı; metinler kaçışlı', () => {
  const s: DailySummary = {
    companyName: 'Demo <Taban>', date: new Date('2026-11-21T07:00:00Z'),
    orders: [{
      id: '1', orderNo: 'SIP-1', customerName: 'Müşteri & Ortak', productName: 'Klasik', productCode: null, totalQuantity: 120, unit: 'çift',
      status: 'ORDER_RECEIVED', confirmedAt: null, dueDate: new Date('2026-11-19T21:00:00Z'), isOverdue: true, isDueToday: false, isDueSoon: false,
    }],
    accounts: [
      { id: 'a', name: 'Kasa', type: 'Kasa', currency: 'TRY', balance: 1500, inflow: 500, outflow: 0 },
      { id: 'b', name: 'Banka $', type: 'Banka', currency: 'USD', balance: 200, inflow: 0, outflow: 50 },
    ],
    sales: { TRY: 2500 }, collections: {},
  };
  const html = summaryHtml(s, 'https://ornek.com/settings');
  assert.match(html, /Demo &lt;Taban&gt;/);
  assert.match(html, /Müşteri &amp; Ortak/);
  assert.match(html, /SIP-1/);
  assert.match(html, /Gecikti/);
  assert.match(html, /Onay bekliyor/);
  assert.match(html, /1 onay bekliyor/);
  assert.match(html, /\+500,00 TRY/);
  assert.match(html, /−50,00 USD/);
  assert.match(html, /1\.500,00 TRY · 200,00 USD/);
  assert.match(html, /Dünkü satış: <b[^>]*>2\.500,00 TRY/);
  assert.match(html, /href="https:\/\/ornek\.com\/settings"/);
});
