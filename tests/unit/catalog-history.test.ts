// Sipariş kataloğu: önce alınanlar ve hammadde eşleştirme önerisi. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyFromRecords, matchScore, sortByHistory, suggestMatch } from '../../lib/catalog-history';

const catalog = [
  { id: 'eva', name: 'EVA Granül Köpük', code: 'HM-EVA' },
  { id: 'pu50', name: 'PU Taban Sistemi Shore 50 (Hafif)', code: 'HM-PU50' },
  { id: 'pu60', name: 'PU Taban Sistemi Shore 60', code: 'HM-PU60' },
  { id: 'pig', name: 'Siyah Pigment Pasta', code: 'HM-PIG-S' },
  { id: 'tpu', name: 'TPU Granül 85A', code: 'HM-TPU85' },
  { id: 'tr', name: 'Termo Kauçuk Hamuru', code: 'HM-TR' },
];

test('alım geçmişi: adet ve son tarih; ürünsüz kayıt yok sayılır', () => {
  const h = historyFromRecords([
    { productId: 'pu60', at: '2026-10-01' }, { productId: 'pu60', at: '2026-11-15' }, { productId: 'tpu', at: '2026-09-01' }, { productId: null, at: '2026-11-20' },
  ]);
  assert.deepEqual(h.get('pu60'), { count: 2, lastAt: new Date('2026-11-15').toISOString() });
  assert.equal(h.get('tpu')!.count, 1);
  assert.equal(h.size, 2);
});

test('önce alınanlar en üstte (en son alınan ilk), diğerleri ada göre', () => {
  const h = historyFromRecords([{ productId: 'tpu', at: '2026-09-01' }, { productId: 'pu60', at: '2026-11-15' }]);
  const sorted = sortByHistory(catalog, h);
  assert.deepEqual(sorted.map(p => p.id), ['pu60', 'tpu', 'eva', 'pu50', 'pig', 'tr']);
  assert.equal(sorted[0].purchased!.count, 1);
  assert.equal(sorted[2].purchased, null);
});

test('eşleştirme önerisi: tabancının hammadde adından satıcı ürünü', () => {
  assert.equal(suggestMatch('TPU Granül 85A', catalog)?.id, 'tpu');
  assert.equal(suggestMatch('EVA Granül', catalog)?.id, 'eva');
  assert.equal(suggestMatch('Termo Kauçuk (TR) Hamur', catalog)?.id, 'tr');
  assert.equal(suggestMatch('Pigment Siyah', catalog)?.id, 'pig');
  assert.equal(suggestMatch('Koli (60x40x40)', catalog), null, 'benzerlik yoksa öneri yok');
});

test('puan 0–1 arası, büyük/küçük harf ve Türkçe karakter duyarsız', () => {
  assert.equal(matchScore('tpu', { name: 'TPU GRANÜL', code: 'X' }), 1);
  assert.equal(matchScore('', { name: 'x' }), 0);
});
