// Anlık bildirim paketleri. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPushBatches, isExpoToken } from '../../lib/push-message';

test('yalnızca Expo token biçimi kabul edilir', () => {
  assert.equal(isExpoToken('ExponentPushToken[abc123]'), true);
  assert.equal(isExpoToken('ExpoPushToken[xyz]'), true);
  assert.equal(isExpoToken('abc123'), false);
  assert.equal(isExpoToken('ExponentPushToken[]'), false);
  assert.equal(isExpoToken(null), false);
});

test('geçersiz ve tekrar eden token atılır; dokununca açılacak ekran data.url', () => {
  const [batch, ...rest] = buildPushBatches(
    ['ExponentPushToken[a]', 'ExponentPushToken[a]', 'bozuk', 'ExponentPushToken[b]'],
    { title: 'Yeni sipariş', body: 'X · SIP-1', url: '/siparis/gelen/1' },
  );
  assert.equal(rest.length, 0);
  assert.deepEqual(batch.map(m => m.to), ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
  assert.deepEqual(batch[0].data, { url: '/siparis/gelen/1' });
  assert.equal(batch[0].channelId, 'orders');
});

test('100\'lük paketlere bölünür, token yoksa gönderim yok', () => {
  const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[t${i}]`);
  assert.deepEqual(buildPushBatches(tokens, { title: 't', body: 'b' }).map(b => b.length), [100, 100, 50]);
  assert.equal(buildPushBatches([], { title: 't', body: 'b' }).length, 0);
  assert.deepEqual(buildPushBatches(['ExponentPushToken[x]'], { title: 't', body: 'b' })[0][0].data, {});
});
