import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteMessage } from '../src/core/invite';

const W = 'https://www.solecost.com';

test('davet mesajı uygulama ve web bağlantısını içerir', () => {
  const m = inviteMessage(W, { companyName: 'Demo Taban', customerName: 'Ayakkabı Dünyası', portalEmail: 'alis@ornek.com' });
  assert.match(m, /^Merhaba Ayakkabı Dünyası,/);
  assert.ok(m.includes('https://www.solecost.com/indir'));
  assert.ok(m.includes('https://www.solecost.com/portal/login'));
  assert.match(m, /Giriş e-postanız: alis@ornek\.com/);
  assert.doesNotMatch(inviteMessage(W, {}), /Giriş e-postanız/);
});
