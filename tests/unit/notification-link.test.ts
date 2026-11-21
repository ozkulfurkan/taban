import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo, webUrlOf } from '../../lib/notification-link';

test('webUrlOf: mobil ekran yolu web sayfasına çevrilir', () => {
  assert.equal(webUrlOf('/siparis/gelen/abc', false), '/orders/abc');
  assert.equal(webUrlOf('/siparis/verilen/abc', false), '/verilen-siparisler/abc');
  assert.equal(webUrlOf('/siparisler/abc', true), '/portal/orders/abc');
});

test('webUrlOf: yanlış hesap türü, bilinmeyen ya da boş yol null döner', () => {
  assert.equal(webUrlOf('/siparisler/abc', false), null);
  assert.equal(webUrlOf('/siparis/gelen/abc', true), null);
  assert.equal(webUrlOf('/bilinmeyen/abc', false), null);
  assert.equal(webUrlOf('https://kotu.example/siparis/gelen/x', false), null);
  assert.equal(webUrlOf('/siparis/gelen/a/b', false), null);
  assert.equal(webUrlOf(null, false), null);
});

test('timeAgo: kısa zaman metni', () => {
  const now = new Date('2026-11-21T12:00:00Z');
  assert.equal(timeAgo(new Date('2026-11-21T11:59:30Z'), now), 'az önce');
  assert.equal(timeAgo(new Date('2026-11-21T11:55:00Z'), now), '5 dk');
  assert.equal(timeAgo(new Date('2026-11-21T09:00:00Z'), now), '3 sa');
  assert.equal(timeAgo(new Date('2026-11-19T12:00:00Z'), now), '2 gün');
});
