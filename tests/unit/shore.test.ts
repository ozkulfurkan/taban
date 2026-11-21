import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanShore, shoreText, variantText, variantLabel, SHORE_NOTE } from '../../lib/shore';

test('shore doğrulama: varsayılanlar ve sınırlar', () => {
  assert.deepEqual(cleanShore(undefined, undefined), { shoreLevel: 'Standart', shoreValue: 65 });
  assert.deepEqual(cleanShore('Sert', '70'), { shoreLevel: 'Sert', shoreValue: 70 });
  assert.deepEqual(cleanShore('bilinmeyen', 60), { shoreLevel: 'Standart', shoreValue: 60 });
  assert.ok('error' in cleanShore('Sert', 101));
  assert.ok('error' in cleanShore('Sert', '65,5'));
  assert.ok('error' in cleanShore('Sert', 'abc'));
});

test('kalem gösterimi: tabanda renk, hammaddede shore', () => {
  assert.equal(shoreText({ shoreLevel: 'Yumuşak', shoreValue: 60 }), 'Yumuşak · 60 Shore (±2)');
  assert.equal(variantText({ unit: 'kg', shoreLevel: 'Standart', shoreValue: 65, color: '' }), 'Standart · 65 Shore (±2)');
  assert.equal(variantText({ unit: 'çift', color: 'Siyah', shoreLevel: 'Sert', shoreValue: 70 }), 'Siyah');
  assert.equal(variantText({ unit: 'kg', color: 'Eski renk' }), 'Eski renk');
  assert.equal(variantLabel('kg'), 'Shore');
  assert.equal(variantLabel(null), 'Renk');
  assert.match(SHORE_NOTE, /±2/);
});
