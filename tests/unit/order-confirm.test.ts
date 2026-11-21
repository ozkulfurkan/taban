import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConfirmed, stageLabel } from '../../lib/order-status';

test('alındı adımında onay durumu okunur', () => {
  assert.equal(stageLabel({ status: 'ORDER_RECEIVED', confirmedAt: null }), 'Onay bekliyor');
  assert.equal(stageLabel({ status: 'ORDER_RECEIVED', confirmedAt: '2026-11-21T08:00:00Z' }), 'Onaylandı');
  assert.equal(stageLabel({ status: 'IN_PRODUCTION', unit: 'kg' }), 'Hazırlanıyor');
});

test('ilerlemiş sipariş onaylı sayılır, iptal sayılmaz', () => {
  assert.equal(isConfirmed({ status: 'PACKAGING' }), true);
  assert.equal(isConfirmed({ status: 'ORDER_RECEIVED' }), false);
  assert.equal(isConfirmed({ status: 'CANCELLED' }), false);
});
