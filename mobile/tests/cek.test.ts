import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableActions, bulkBody, singleCurrency, suggestedSupplierAmounts } from '../src/core/cek';

test('işlem kuralları sunucuyla aynı', () => {
  assert.deepEqual(availableActions([]), { bank: false, supplier: false, collect: false });
  assert.deepEqual(availableActions([{ durum: 'PORTFOY' }, { durum: 'PORTFOY' }]), { bank: true, supplier: true, collect: true });
  assert.deepEqual(availableActions([{ durum: 'PORTFOY' }, { durum: 'BANKAYA_VERILDI' }]), { bank: false, supplier: false, collect: true });
  assert.deepEqual(availableActions([{ durum: 'ODENDI' }]), { bank: false, supplier: false, collect: false });
  assert.deepEqual(availableActions([{ durum: 'TEDARIKCI_VERILDI' }, { durum: 'PORTFOY' }]), { bank: false, supplier: false, collect: false });
});

test('tahsilde tek döviz şartı', () => {
  assert.equal(singleCurrency([{ currency: 'TRY' }, { currency: 'TRY' }]), 'TRY');
  assert.equal(singleCurrency([{ currency: 'TRY' }, { currency: 'USD' }]), null);
});

test('tedarikçi dövizine çevirme: aynı döviz aynen, farklı döviz kurla, kur yoksa boş', () => {
  const rates = { usd: 35, eur: 38 };
  const r = suggestedSupplierAmounts([
    { id: 'a', tutar: 1000, currency: 'USD' },
    { id: 'b', tutar: 3500.555, currency: 'TRY' },
    { id: 'c', tutar: 100, currency: 'EUR' },
  ], 'TRY', rates);
  assert.deepEqual(r, { a: 35000, b: 3500.56, c: 3800 });
  assert.equal(suggestedSupplierAmounts([{ id: 'x', tutar: 10, currency: 'USD' }], 'TRY', {}).x, null);
  assert.equal(suggestedSupplierAmounts([{ id: 'y', tutar: 3500, currency: 'TRY' }], 'USD', rates).y, 100);
});

test('toplu işlem gövdeleri', () => {
  assert.deepEqual(bulkBody('bank', ['a', 'b'], { accountId: 'acc', date: '2026-11-19', note: '  ' }),
    { action: 'bank', ids: ['a', 'b'], date: '2026-11-19', note: undefined, accountId: 'acc' });
  assert.deepEqual(bulkBody('supplier', ['a'], { supplierId: 's', amounts: { a: 35000 } }),
    { action: 'supplier', ids: ['a'], date: undefined, note: undefined, supplierId: 's', items: [{ id: 'a', amount: 35000 }] });
});
