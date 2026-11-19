import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountToInput as n2i, formatAmountInput as f, parseAmountInput as p } from '../src/core/amount';

test('kayıtlı sayı alana doğru çevrilir (nokta binlik sanılmaz)', () => {
  assert.equal(n2i(0.1234, 4), '0,1234');
  assert.equal(p(n2i(0.1234, 4)), 0.1234);
  assert.equal(n2i(12.345, 4), '12,345');
  assert.equal(n2i(1250.5), '1.250,5');
  assert.equal(n2i(3500), '3.500');
  assert.equal(n2i(0.0285, 4), '0,0285');
  assert.equal(n2i(1.005, 2), '1');
  assert.equal(n2i(null), '');
});

test('binlik ayırıcı yazarken eklenir', () => {
  assert.equal(f('3500'), '3.500');
  assert.equal(f('1234567'), '1.234.567');
  assert.equal(f('3.500'), '3.500');
  assert.equal(p(f('3.500')), 3500);
  assert.equal(f('007'), '7');
});

test('ondalık virgül; ondalık tuşu nokta ise virgüle döner', () => {
  assert.equal(f('3500,2'), '3.500,2');
  assert.equal(f('3500,256'), '3.500,25');
  assert.equal(f('3500.'), '3.500,');
  assert.equal(f(',5'), '0,5');
  assert.equal(p('3.500,25'), 3500.25);
});

test('yapıştırılan değerler', () => {
  assert.equal(f('3500.25'), '3.500,25');
  assert.equal(f('1.234,56'), '1.234,56');
  assert.equal(f('12 345 TL'), '12.345');
  assert.equal(f(''), '');
  assert.equal(p(''), 0);
});

test('kur: 4 ondalık', () => {
  assert.equal(f('34,56789', 4), '34,5678');
  assert.equal(p('34,5678'), 34.5678);
});
