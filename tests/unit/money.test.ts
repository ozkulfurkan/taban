// Para hesaplarının birim testleri. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  round2, parseAmount, lineTotal, invoiceTotals, customerBalance, invoiceBalanceEffect,
} from '../../lib/money';
import { validateInvoiceInput } from '../../lib/invoice-input';
import { parseDateInput } from '../../lib/time';
import { documentYear } from '../../lib/doc-number';

test('parseAmount: Türkçe ve İngilizce sayı biçimleri', () => {
  const cases: Array<[unknown, number]> = [
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['12,50', 12.5],
    ['1,234.56', 1234.56],
    ['1234.56', 1234.56],
    ['1.234.567', 1234567],
    ['1.234.567,89', 1234567.89],
    [' 1.234,56 TL', 1234.56],
    ['₺99,90', 99.9],
    [12.5, 12.5],
    ['0', 0],
  ];
  for (const [input, expected] of cases) assert.equal(parseAmount(input), expected, `girdi: ${input}`);
});

test('parseAmount: sayı olmayan değerler NaN döner', () => {
  for (const input of ['abc', '', null, undefined, '12a', '1-2']) {
    assert.ok(Number.isNaN(parseAmount(input)), `girdi: ${input}`);
  }
});

test('round2: kayan nokta hatalarını kuruşa yuvarlar', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(20.058), 20.06);
  assert.equal(round2(-2.345), -2.34);
});

test('lineTotal: iskonto dahil, kuruşa yuvarlanmış', () => {
  assert.equal(lineTotal({ quantity: 3, unitPrice: '33,33' }), 99.99);
  assert.equal(lineTotal({ quantity: 10, unitPrice: 100, discount: 15 }), 850);
  assert.equal(lineTotal({ quantity: '1', unitPrice: '1.234,56' }), 1234.56);
});

test('invoiceTotals: ara toplam, KDV ve toplam iki haneli', () => {
  const t = invoiceTotals([
    { quantity: 3, unitPrice: '33,33' },
    { quantity: 1, unitPrice: '0,1' },
    { quantity: 1, unitPrice: '0,2' },
  ], 20);
  assert.equal(t.subtotal, 100.29);
  assert.equal(t.vatAmount, 20.06);
  assert.equal(t.total, 120.35);
});

test('customerBalance: iade borcu azaltır (pozitif ya da eski negatif kayıt)', () => {
  const sale = { total: 1000, isReturn: false };
  assert.equal(customerBalance([sale, { total: 200, isReturn: true }], []).balance, 800);
  assert.equal(customerBalance([sale, { total: -200, isReturn: true }], []).balance, 800);
  assert.equal(invoiceBalanceEffect({ total: -200, isReturn: true }), -200);
});

test('customerBalance: tahsilat, borç fişi, bakiye düzeltme ve çek', () => {
  const r = customerBalance(
    [{ total: 1000, isReturn: false }],
    [
      { amount: 300, method: 'Nakit' },
      { amount: 50, method: 'Borç Fişi' },
      { amount: 20, method: 'Bakiye Düzeltme', notes: '+ düzeltme' },
      { amount: 10, method: 'Bakiye Düzeltme', notes: '- düzeltme' },
    ],
    [{ tutar: 5000, customerAmount: 100 }, { tutar: 40 }],
  );
  assert.equal(r.balance, 1000 - 300 + 50 + 20 - 10 - 100 - 40);
  assert.equal(r.totalCek, 140);
});

test('validateInvoiceInput: geçersiz girdileri Türkçe mesajla reddeder', () => {
  const ok = { quantity: 1, unitPrice: 10, description: 'Taban' };
  const bad: Array<[any, RegExp]> = [
    [{ items: [] }, /en az bir kalem/],
    [{ items: [{ ...ok, quantity: -5 }] }, /1\. kalem: miktar/],
    [{ items: [ok, { ...ok, quantity: 'abc' }] }, /2\. kalem: miktar/],
    [{ items: [{ ...ok, unitPrice: -1 }] }, /birim fiyat geçersiz/],
    [{ items: [{ ...ok, unitPrice: 1e12 }] }, /çok büyük/],
    [{ items: [{ ...ok, discount: 150 }] }, /iskonto/],
    [{ items: [ok], vatRate: -20 }, /KDV/],
    [{ items: [{ ...ok, description: '  ' }] }, /açıklama/],
    [{ items: [ok], date: '2026-02-30' }, /tarihi geçersiz/],
  ];
  for (const [body, msg] of bad) {
    const r = validateInvoiceInput(body);
    assert.equal(r.ok, false, JSON.stringify(body));
    if (!r.ok) assert.match(r.error, msg);
  }
});

test('validateInvoiceInput: geçerli girdi pozitif ve yuvarlanmış tutar üretir', () => {
  const r = validateInvoiceInput({ vatRate: '20', items: [{ quantity: '100', unitPrice: '12,50', description: 'Taban 40' }] });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.subtotal, 1250);
    assert.equal(r.vatAmount, 250);
    assert.equal(r.total, 1500);
    assert.equal(r.lines[0].total, 1250);
  }
  const keepVat = validateInvoiceInput({ items: [{ quantity: 1, unitPrice: 100, description: 'x' }] }, { defaultVatRate: 18 });
  assert.ok(keepVat.ok && keepVat.vatRate === 18 && keepVat.total === 118);
});

test('parseDateInput: takvimde olmayan günleri reddeder', () => {
  assert.equal(parseDateInput('2026-02-30'), null);
  assert.equal(parseDateInput('2026-13-01'), null);
  assert.equal(parseDateInput('2026-11-01T25:00'), null);
  assert.equal(parseDateInput('2028-02-29')?.toISOString(), '2028-02-28T21:00:00.000Z');
});

test('documentYear: İstanbul saatine göre yıl', () => {
  // 31 Aralık 2026 22:30 UTC = 1 Ocak 2027 01:30 İstanbul
  assert.equal(documentYear(new Date('2026-12-31T22:30:00Z')), 2027);
  assert.equal(documentYear(new Date('2026-12-31T20:00:00Z')), 2026);
});

import { foldTr, matchesText } from '../../lib/search';

test('Türkçe karakterden bağımsız arama', () => {
  for (const q of ['ışık', 'Işık', 'IŞIK', 'isik', 'ISIK']) assert.ok(matchesText('IŞIK Ayakkabı', q), q);
  for (const q of ['istanbul', 'İSTANBUL', 'İstanbul']) assert.ok(matchesText('İstanbul Taban', q), q);
  assert.equal(foldTr('ÇİĞDEM Göğüş Şükrü Öztürk'), 'cigdem gogus sukru ozturk');
  assert.ok(!matchesText('Ayakkabı', 'terlik'));
  assert.ok(matchesText(null, ''));
});

import { normalizeDecimal } from '../../app/components/decimal-input';
import { fmtQty, stockTone } from '../../lib/stock-display';

test('normalizeDecimal: Türkçe virgülü noktaya çevirir, harfleri atar', () => {
  const cases: Array<[string, string]> = [
    ['12,5', '12.5'],
    ['1.234,56', '1234.56'],
    ['12.5', '12.5'],
    ['-3', '-3'],
    ['3-', '3'], // eksi sadece başta geçerli
    ['abc12', '12'],
    ['1,2,3', '1.23'],
    [' 1 000 ', '1000'],
    ['', ''],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeDecimal(input), expected, `girdi: ${input}`);
});

test('stok gösterimi: binlik ayraç ve eksi/sıfır ayrımı', () => {
  assert.equal(fmtQty(1940), '1.940');
  assert.equal(fmtQty(-999149), '-999.149');
  assert.equal(fmtQty(12.5), '12,5');
  assert.equal(fmtQty(-0), '0');
  assert.equal(stockTone(-3), 'negative');
  assert.equal(stockTone(0), 'zero');
  assert.equal(stockTone(5), 'positive');
});

import { docTotals, emptyLine, lineNet, lineProblem, purchaseItemsPayload, invoiceItemsPayload } from '../../lib/document-lines';

test('belge kalemleri: Türkçe girişten tutar, iskonto ve KDV', () => {
  const lines = [
    emptyLine({ description: 'Taban', quantity: '3', unitPrice: '33,33' }),
    emptyLine({ description: 'Taban', quantity: '10', unitPrice: '100', discount: '15' }),
  ];
  assert.equal(lineNet(lines[0]), 99.99);
  assert.equal(lineNet(lines[1]), 850);
  assert.deepEqual(docTotals(lines, 20), { subtotal: 949.99, vatAmount: 190, total: 1139.99 });
  assert.deepEqual(docTotals([], 20), { subtotal: 0, vatAmount: 0, total: 0 });
});

test('belge kalemleri: kayıt öncesi kontrol ve API gövdesi', () => {
  assert.match(lineProblem('sale', emptyLine({ description: 'x', quantity: '0', unitPrice: '1' }), 0)!, /1\. kalem: miktar/);
  assert.match(lineProblem('purchase', emptyLine({ quantity: '1', unitPrice: '1' }), 1)!, /2\. kalem: ürün ya da hammadde/);
  assert.match(lineProblem('return', emptyLine({ description: 'x', quantity: '1', unitPrice: '1', discount: '120' }), 0)!, /iskonto/);
  assert.equal(lineProblem('sale', emptyLine({ description: 'Taban', quantity: '2', unitPrice: '1,5' }), 0), null);

  const mat = emptyLine({ itemType: 'material', materialId: 'm1', description: 'Kauçuk', quantity: '12,5', unitPrice: '2,40' });
  const prod = emptyLine({ itemType: 'product', productId: 'p1', description: 'Taban', quantity: '4', unitPrice: '10' });
  assert.deepEqual(purchaseItemsPayload([mat, prod], 'sub1'), [
    { productId: null, materialId: 'm1', subcontractorId: 'sub1', description: 'Kauçuk', qty: 12.5, unitPrice: 2.4 },
    { productId: 'p1', materialId: null, subcontractorId: null, description: 'Taban', qty: 4, unitPrice: 10 },
  ]);
  assert.equal(invoiceItemsPayload([prod])[0].quantity, 4);
});

import { convertAmount, crossRate } from '../../lib/fx';
import { daysToVade, vadeTone, weightedAvgVade, totalsByCurrency } from '../../lib/cek';

test('kur çevirme: TCMB satış kuruyla çapraz kur', () => {
  const rates = { usd: 34, eur: 37 };
  assert.equal(convertAmount(3400, 'TRY', 'USD', rates), 100);
  assert.equal(convertAmount(100, 'USD', 'TRY', rates), 3400);
  assert.equal(convertAmount(100, 'EUR', 'USD', rates), 108.82);
  assert.equal(convertAmount(50, 'USD', 'USD', rates), 50);
  assert.equal(convertAmount(100, 'TRY', 'EUR', {}), null);
  assert.equal(crossRate('USD', 'EUR', rates)!.toFixed(4), (34 / 37).toFixed(4));
});

test('çek vadesi: gün farkı, renk ve ağırlıklı ortalama', () => {
  const now = new Date('2026-11-18T10:00:00');
  assert.equal(daysToVade('2026-11-18T00:00:00', now), 0);
  assert.equal(daysToVade('2026-11-15T00:00:00', now), -3);
  assert.equal(vadeTone({ vadesi: '2026-11-15', durum: 'PORTFOY' }, now), 'overdue');
  assert.equal(vadeTone({ vadesi: '2026-11-15', durum: 'ODENDI' }, now), 'normal');
  assert.equal(vadeTone({ vadesi: '2026-11-24', durum: 'BANKAYA_VERILDI' }, now), 'soon');
  assert.equal(vadeTone({ vadesi: '2026-12-30', durum: 'PORTFOY' }, now), 'normal');
  // 1000 TL 10 gün, 3000 TL 30 gün → ortalama 25 gün
  const avg = weightedAvgVade([
    { tutar: 1000, currency: 'TRY', vadesi: '2026-11-28T10:00:00' },
    { tutar: 3000, currency: 'TRY', vadesi: '2026-12-18T10:00:00' },
  ], {}, now)!;
  assert.equal(avg.days, 25);
  // 100 USD (=3400 TL) ağırlığı 1000 TL'den büyük
  const fx = weightedAvgVade([
    { tutar: 1000, currency: 'TRY', vadesi: '2026-11-28T10:00:00' },
    { tutar: 100, currency: 'USD', vadesi: '2026-12-18T10:00:00' },
  ], { usd: 34 }, now)!;
  assert.ok(fx.days > 20, String(fx.days));
  assert.deepEqual(totalsByCurrency([{ tutar: 1, currency: 'USD' }, { tutar: 2.5, currency: 'TRY' }, { tutar: 0.1, currency: 'USD' }]),
    [{ currency: 'TRY', count: 1, total: 2.5 }, { currency: 'USD', count: 2, total: 1.1 }]);
});
