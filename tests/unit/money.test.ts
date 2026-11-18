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
