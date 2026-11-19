// Firma aboneliği ve salt okunur kuralı. Çalıştırma: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planOfProduct, subscriptionState, subscriptionUntilMs, tokenSubscriptionActive } from '../../lib/subscription';
import { checkApiAccess } from '../../lib/access';

const now = new Date('2026-11-21T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

test('abonelik öncesi firma (LEGACY) ve elle süresiz PRO: süresiz aktif', () => {
  const s = subscriptionState({ subscriptionStatus: 'PRO', proUntil: null, subscriptionSource: 'LEGACY' }, now);
  assert.equal(s.active, true);
  assert.equal(s.kind, 'lifetime');
  assert.equal(subscriptionUntilMs({ subscriptionStatus: 'PRO', proUntil: null }), null);
});

test('deneme süresi: kalan gün ve bitince salt okunur', () => {
  const t = subscriptionState({ subscriptionStatus: 'TRIAL', trialEndsAt: days(10) }, now);
  assert.deepEqual([t.active, t.kind, t.daysLeft], [true, 'trial', 10]);
  const e = subscriptionState({ subscriptionStatus: 'TRIAL', trialEndsAt: days(-1) }, now);
  assert.deepEqual([e.active, e.kind, e.daysLeft], [false, 'expired', 0]);
});

test('Apple aboneliği: bitişe kadar aktif; dolunca, deneme sürüyorsa deneme geçerli', () => {
  assert.equal(subscriptionState({ subscriptionStatus: 'PRO', proUntil: days(30) }, now).kind, 'pro');
  assert.equal(subscriptionState({ subscriptionStatus: 'PRO', proUntil: days(-2), trialEndsAt: days(5) }, now).kind, 'trial');
  assert.equal(subscriptionState({ subscriptionStatus: 'PRO', proUntil: days(-2), trialEndsAt: days(-20) }, now).active, false);
});

test('FREE durumundaki firma salt okunur', () => {
  assert.equal(subscriptionState({ subscriptionStatus: 'FREE' }, now).active, false);
  assert.equal(subscriptionUntilMs({ subscriptionStatus: 'FREE' }), 0);
});

test('token özeti: en geç geçerlilik anı', () => {
  assert.equal(subscriptionUntilMs({ subscriptionStatus: 'PRO', proUntil: days(30), trialEndsAt: days(5) }), days(30).getTime());
  assert.equal(subscriptionUntilMs({ subscriptionStatus: 'TRIAL', trialEndsAt: days(5) }), days(5).getTime());
  assert.equal(tokenSubscriptionActive(undefined), true, 'abonelik sistemi öncesi verilmiş token kısıtlanmaz');
  assert.equal(tokenSubscriptionActive(null), true);
  assert.equal(tokenSubscriptionActive(days(1).getTime(), now.getTime()), true);
  assert.equal(tokenSubscriptionActive(days(-1).getTime(), now.getTime()), false);
});

test('ürün kimliğinden plan', () => {
  assert.equal(planOfProduct('solecost_pro_yearly'), 'YEARLY');
  assert.equal(planOfProduct('solecost_pro_annual'), 'YEARLY');
  assert.equal(planOfProduct('solecost_pro_monthly'), 'MONTHLY');
  assert.equal(planOfProduct(null), null);
});

test('süresi dolan firma: okuma serbest, yazma 402; abonelik/oturum/destek yazılabilir; yönetici muaf', () => {
  const expired = { type: 'staff', role: 'COMPANY_OWNER', subUntil: 1 };
  assert.deepEqual(checkApiAccess(expired, 'GET', '/api/customers'), { ok: true });
  const w = checkApiAccess(expired, 'POST', '/api/invoices');
  assert.equal(w.ok, false);
  assert.equal(!w.ok && w.status, 402);
  assert.equal(!w.ok && w.code, 'SUBSCRIPTION_REQUIRED');
  assert.equal(checkApiAccess(expired, 'DELETE', '/api/customers/x').ok, false);
  for (const p of ['/api/subscription/sync', '/api/mobile/auth/refresh', '/api/mobile/push-token', '/api/support/tickets', '/api/statement-links']) {
    assert.equal(checkApiAccess(expired, 'POST', p).ok, true, p);
  }
  assert.equal(checkApiAccess({ ...expired, role: 'ADMIN' }, 'POST', '/api/invoices').ok, true);
  assert.equal(checkApiAccess({ type: 'staff', role: 'COMPANY_OWNER', subUntil: null }, 'POST', '/api/invoices').ok, true);
  assert.equal(checkApiAccess({ type: 'staff', role: 'COMPANY_OWNER' }, 'POST', '/api/invoices').ok, true);
});
