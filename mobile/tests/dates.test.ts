import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateFromIso, displayDate, isoFromDate, isoFromDisplay } from '../src/core/dates';

test('API biçimi ↔ ekran biçimi (gün kaymadan)', () => {
  assert.equal(displayDate('2026-11-25'), '25.11.2026');
  assert.equal(displayDate('2026-01-05'), '05.01.2026');
  assert.equal(displayDate(''), '');
  assert.equal(isoFromDate(new Date(2026, 10, 25, 23, 59)), '2026-11-25');
  assert.equal(isoFromDate(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  assert.equal(isoFromDate(dateFromIso('2026-03-29')!), '2026-03-29'); // yaz saati geçişi
});

test('elle girilen GG.AA.YYYY', () => {
  assert.equal(isoFromDisplay('25.11.2026'), '2026-11-25');
  assert.equal(isoFromDisplay('5/1/2026'), '2026-01-05');
  assert.equal(isoFromDisplay('31.02.2026'), null);
  assert.equal(isoFromDisplay('2026-11-25'), null);
  assert.equal(dateFromIso('25.11.2026'), null);
});
