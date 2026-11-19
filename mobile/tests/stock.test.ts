import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adjustBody, formatQty, nextStock, validateAdjust } from '../src/core/stock';

test('ürün düzeltme gövdesi: giriş artı, çıkış eksi delta; not boşsa gönderilmez', () => {
  assert.deepEqual(adjustBody('product', 'in', 24, ' Sayım fazlası '), { delta: 24, notes: 'Sayım fazlası' });
  assert.deepEqual(adjustBody('product', 'out', 4, ''), { delta: -4, notes: undefined });
});

test('hammadde gövdesi: artırma/azaltma delta, sayım absoluteValue', () => {
  assert.deepEqual(adjustBody('material', 'in', 12.5, ''), { type: 'artirma', delta: 12.5, notes: undefined });
  assert.deepEqual(adjustBody('material', 'out', 0.25, 'fire'), { type: 'azaltma', delta: -0.25, notes: 'fire' });
  assert.deepEqual(adjustBody('material', 'count', 150.5, ''), { type: 'stok_guncelleme', absoluteValue: 150.5, notes: undefined });
});

test('işlem sonrası stok ve kayan nokta artığı', () => {
  assert.equal(nextStock('in', 24, 10), 34);
  assert.equal(nextStock('out', 100.2, 150.5), 50.3);
  assert.equal(nextStock('count', 150.5, 80), 150.5);
  assert.equal(nextStock('out', 5, 3), -2);
});

test('doğrulama: boş/sıfır, ürün tam sayı, sayım yalnız hammadde, sayım aynı değer', () => {
  assert.equal(validateAdjust('product', 'in', 0, 10), 'Miktar girin.');
  assert.equal(validateAdjust('product', 'in', 1.5, 10), 'Ürün miktarı tam sayı olmalı.');
  assert.equal(validateAdjust('product', 'count', 5, 10), 'Sayım yalnızca hammaddede yapılır.');
  assert.equal(validateAdjust('material', 'count', 80, 80), 'Sayılan miktar mevcut stokla aynı.');
  assert.equal(validateAdjust('material', 'count', 0, 80), null);
  assert.equal(validateAdjust('material', 'out', 0.5, 0), null);
});

test('miktar gösterimi Türkçe', () => {
  assert.equal(formatQty(1250), '1.250');
  assert.equal(formatQty(150.5), '150,5');
  assert.equal(formatQty(-2), '-2');
});
