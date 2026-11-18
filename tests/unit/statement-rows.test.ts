import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerRows, buildSupplierRows } from '../../lib/statement-rows';

const d = (s: string) => `${s}T10:00:00.000Z`;

test('müşteri ekstresi: satış, kalem, iade, tahsilat, çek, fişler ve bakiye', () => {
  const r = buildCustomerRows({
    invoices: [
      { id: 'i1', date: d('2026-01-01'), createdAt: d('2026-01-01'), invoiceNo: 'F1', total: 100, isReturn: false,
        items: [{ description: 'Taban', quantity: 2, unitPrice: 50, total: 100, product: { code: 'T1' } }] },
      { id: 'i2', date: d('2026-01-05'), createdAt: d('2026-01-05'), invoiceNo: 'F2', total: -10, isReturn: true, items: [] },
    ],
    payments: [
      { id: 'p1', date: d('2026-01-03'), createdAt: d('2026-01-03'), amount: 30, method: 'Nakit', notes: '' },
      { id: 'p2', date: d('2026-01-04'), createdAt: d('2026-01-04'), amount: 5, method: 'Borç Fişi', notes: 'Vade:2026-02-01 | kur farkı' },
      { id: 'p3', date: d('2026-01-06'), createdAt: d('2026-01-06'), amount: 2, method: 'Bakiye Düzeltme', notes: '- | düzeltme' },
    ],
    cekler: [{ id: 'c1', islemTarihi: d('2026-01-02'), createdAt: d('2026-01-02'), tutar: 400, currency: 'TRY', customerAmount: 10, seriNo: 'S1' }],
  });
  const main = r.rows.filter(x => !x.isSubRow);
  assert.deepEqual(main.map(x => x.hareket), ['Satış', 'Çek', 'Tahsilat', 'Borç Fişi', 'İade', 'Bakiye Düzeltme']);
  assert.deepEqual(main.map(x => x.bakiye), [100, 90, 60, 65, 55, 53]);
  assert.equal(r.totalBorc, 105);
  assert.equal(r.totalAlacak, 52);
  assert.equal(r.lastBalance, 53);
  const item = r.rows.find(x => x.isSubRow)!;
  assert.equal(item.parentId, 'i1');
  assert.equal(item.productCode, 'T1');
  assert.equal(item.tutar, 100);
  assert.equal(main[3].aciklama, 'kur farkı');
  assert.equal(main[5].aciklama, 'düzeltme');
  assert.match(main[1].extraInfo!, /400,00 TRY/);
});

test('tedarikçi ekstresi: alış, alış iadesi, ödeme ve iade ödemesi', () => {
  const r = buildSupplierRows({
    purchases: [
      { id: 'a1', date: d('2026-01-01'), createdAt: d('2026-01-01'), invoiceNo: 'A1', total: 300, isReturn: false,
        items: [{ description: 'PVC', quantity: 100, unitPrice: 3, total: 300 }] },
      { id: 'a2', date: d('2026-01-02'), createdAt: d('2026-01-02'), invoiceNo: 'A2', total: 50, isReturn: true },
    ],
    payments: [
      { id: 'p1', date: d('2026-01-03'), createdAt: d('2026-01-03'), amount: 100, method: 'Havale', notes: '' },
      { id: 'p2', date: d('2026-01-03'), createdAt: d('2026-01-04'), amount: 10, method: 'Nakit', notes: 'İade' },
    ],
  });
  const main = r.rows.filter(x => !x.isSubRow);
  assert.deepEqual(main.map(x => x.hareket), ['Alış', 'Alış İadesi', 'Ödeme', 'İade']);
  assert.deepEqual(main.map(x => x.bakiye), [300, 250, 150, 140]);
  assert.equal(r.totalBorc, 300);
  assert.equal(r.totalAlacak, 160);
  assert.equal(r.rows.filter(x => x.isSubRow).length, 1);
});

test('boş ya da hatalı veri', () => {
  assert.deepEqual(buildCustomerRows(null), { rows: [], totalBorc: 0, totalAlacak: 0, lastBalance: 0 });
  assert.deepEqual(buildSupplierRows({ error: 'x' }), { rows: [], totalBorc: 0, totalAlacak: 0, lastBalance: 0 });
});
