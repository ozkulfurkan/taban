import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feeEffect, feeNotes } from '../src/core/fee';

test('borç fişi bakiyeyi artırır, alacak fişi azaltır', () => {
  assert.equal(feeEffect('Borç Fişi', 150), 150);
  assert.equal(feeEffect('Alacak Fişi', 150), -150);
});

test('notlar web biçiminde: vade ve açıklama', () => {
  assert.equal(feeNotes('2026-12-01', ' fiyat farkı '), 'Vade:2026-12-01 | fiyat farkı');
  assert.equal(feeNotes('', ''), null);
  assert.equal(feeNotes('2026-12-01', ''), 'Vade:2026-12-01');
});
