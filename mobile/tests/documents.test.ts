import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invoiceBody, purchaseBody, totalsOf, validateLines, type FormLine } from '../src/core/documents';

const line = (p: Partial<FormLine>): FormLine => ({
  key: Math.random().toString(36), type: 'product', productId: 'p1', description: 'Taban', quantity: '1', unitPrice: '0', discount: '0', ...p,
});

test('toplamlar sunucuyla aynı: kalem yuvarlanır, KDV ara toplamdan', () => {
  const t = totalsOf([
    line({ quantity: '1.250', unitPrice: '2,35' }),               // 2.937,50
    line({ quantity: '3', unitPrice: '10', discount: '12,5' }),    // 26,25
  ], 20);
  assert.deepEqual(t.lineTotals, [2937.5, 26.25]);
  assert.equal(t.subtotal, 2963.75);
  assert.equal(t.vatAmount, 592.75);
  assert.equal(t.total, 3556.5);
});

test('satış gövdesi: Türkçe biçimli girdiler sayıya çevrilir, serbest kalemde ürün yok', () => {
  const b = invoiceBody({
    kind: 'sale', customerId: 'c1', currency: 'USD', date: '2026-11-19', dueDate: '2026-12-19', vatRate: 20, notes: '  ',
    lines: [line({ quantity: '1.250', unitPrice: '2,35' }), line({ type: 'free', productId: 'x', description: ' Nakliye ', quantity: '1', unitPrice: '150' })],
  });
  assert.equal(b.isReturn, false);
  assert.equal(b.notes, null);
  assert.equal(b.dueDate, '2026-12-19');
  assert.deepEqual(b.items[0], { description: 'Taban', productId: 'p1', quantity: 1250, unitPrice: 2.35, discount: 0 });
  assert.deepEqual(b.items[1], { description: 'Nakliye', productId: null, quantity: 1, unitPrice: 150, discount: 0 });
  const r = invoiceBody({ kind: 'return', customerId: 'c1', currency: 'USD', date: '2026-11-19', dueDate: '2026-12-19', vatRate: 0, notes: '', lines: [line({ quantity: '2', unitPrice: '5' })] });
  assert.equal(r.isReturn, true);
  assert.equal(r.dueDate, undefined); // iadede vade yok
});

test('alış gövdesi: hammadde kg ve fiyat, iade bayrağı', () => {
  const b = purchaseBody({
    kind: 'purchaseReturn', supplierId: 's1', currency: 'TRY', date: '2026-11-19', notes: 'Kusurlu',
    lines: [line({ type: 'material', productId: undefined, materialId: 'm1', description: 'PVC', quantity: '1.000,5', unitPrice: '42,1' })],
  });
  assert.equal(b.isReturn, true);
  assert.deepEqual(b.items, [{ productId: undefined, materialId: 'm1', qty: 1000.5, unitPrice: 42.1 }]);
});

test('kaydetmeden önce kalem kontrolleri', () => {
  assert.equal(validateLines('sale', []), 'En az bir kalem ekleyin.');
  assert.match(validateLines('sale', [line({ quantity: '' })])!, /miktar/);
  assert.match(validateLines('sale', [line({ description: ' ' })])!, /açıklama/);
  assert.match(validateLines('sale', [line({ quantity: '1', discount: '120' })])!, /iskonto/);
  assert.match(validateLines('purchase', [line({ type: 'free', productId: undefined })])!, /ürün ya da hammadde/);
  assert.equal(validateLines('purchase', [line({ unitPrice: '0' })]), 'Alış toplamı 0 olamaz.');
  assert.equal(validateLines('sale', [line({ unitPrice: '0' })]), null); // ücretsiz satış kalemi olabilir
});
