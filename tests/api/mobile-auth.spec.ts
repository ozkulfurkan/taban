import { test, expect, APIRequestContext, request as pwRequest } from '@playwright/test';
import { prisma, RUN, BASE_URL, PASSWORD, createCompany, createUser, createPortalCustomer, email, cleanup } from '../security/helpers';

// Mobil uygulama oturumu: /api/mobile/auth/login ile alınan token "Authorization: Bearer"
// başlığıyla mevcut API'leri çerezsiz kullanır; firma ayrımı, roller ve oturum iptali aynen geçerli.

let A: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let B: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;

test.beforeAll(async () => {
  A = await createCompany('mobil');
  B = await createCompany('mobil-b');
  anon = await pwRequest.newContext({ baseURL: BASE_URL });
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

async function login(userEmail: string, kind: 'staff' | 'portal' = 'staff', password = PASSWORD) {
  return anon.post('/api/mobile/auth/login', { data: { email: userEmail, password, kind } });
}
async function tokenFor(userEmail: string, kind: 'staff' | 'portal' = 'staff') {
  const r = await login(userEmail, kind);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).token as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

test('firma kullanıcısı: giriş, oturum bilgisi ve Bearer ile API erişimi (yalnızca kendi firması)', async () => {
  const r = await login(A.ownerEmail);
  expect(r.status()).toBe(200);
  expect(r.headers()['cache-control']).toContain('no-store');
  const body = await r.json();
  expect(body.user).toMatchObject({ type: 'staff', role: 'COMPANY_OWNER', email: A.ownerEmail });
  expect(body.user.companyName).toContain('mobil firma');
  expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);

  const me = await anon.get('/api/mobile/auth/me', { headers: auth(body.token) });
  expect(me.status()).toBe(200);
  expect((await me.json()).user.email).toBe(A.ownerEmail);

  const name = `Mobil Müşteri ${RUN}`;
  const created = await anon.post('/api/customers', { headers: auth(body.token), data: { name, currency: 'TRY' } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const cus = await created.json();
  expect(cus.companyId).toBe(A.companyId);

  const tokenB = await tokenFor(B.ownerEmail);
  expect((await anon.get(`/api/customers/${cus.id}`, { headers: auth(tokenB) })).status()).toBe(404);
  expect((await anon.get(`/api/customers/${cus.id}`, { headers: auth(body.token) })).status()).toBe(200);
});

test('hatalı giriş 401; eksik alan 400; tekrar eden hatalar 429', async () => {
  expect((await login(A.ownerEmail, 'staff', 'yanlis-sifre')).status()).toBe(401);
  expect((await login('yok-' + email('x'))).status()).toBe(401);
  expect((await anon.post('/api/mobile/auth/login', { data: { email: A.ownerEmail } })).status()).toBe(400);

  const victim = await createUser(A.companyId, `mobil-kilit-${Math.random().toString(36).slice(2, 6)}`, 'EDITOR');
  for (let i = 0; i < 5; i++) await login(victim, 'staff', 'yanlis');
  const locked = await login(victim);
  expect(locked.status()).toBe(429);
  expect((await locked.json()).code).toBe('TOO_MANY_ATTEMPTS');
});

test('geçersiz ya da oturumsuz Bearer reddedilir', async () => {
  expect((await anon.get('/api/mobile/auth/me')).status()).toBe(401);
  expect((await anon.get('/api/mobile/auth/me', { headers: { Authorization: 'Bearer abc' } })).status()).toBe(401);
  const t = await tokenFor(A.ownerEmail);
  const tampered = t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  expect((await anon.get('/api/mobile/auth/me', { headers: auth(tampered) })).status()).toBe(401);
  expect((await anon.get('/api/customers', { headers: auth(tampered) })).status()).toBe(401);
});

test('roller Bearer ile de geçerli; rol değişince mobil oturum düşer', async () => {
  const viewerEmail = await createUser(A.companyId, `mobil-viewer-${Math.random().toString(36).slice(2, 6)}`, 'VIEWER');
  const t = await tokenFor(viewerEmail);
  expect((await anon.get('/api/customers', { headers: auth(t) })).status()).toBe(200);
  expect((await anon.post('/api/customers', { headers: auth(t), data: { name: `Viewer ${RUN}` } })).status()).toBe(403);

  await prisma.user.update({ where: { email: viewerEmail }, data: { role: 'EDITOR' } });
  expect((await anon.get('/api/mobile/auth/me', { headers: auth(t) })).status()).toBe(401);
  expect((await anon.get('/api/customers', { headers: auth(t) })).status()).toBe(401);
});

test('portal müşterisi: portal girişi, portal API erişimi, firma API yasak', async () => {
  const cus = await prisma.customer.create({ data: { companyId: A.companyId, name: `Portal Mobil ${RUN}` } });
  const portalEmail = await createPortalCustomer(cus.id, `mobil-portal-${Math.random().toString(36).slice(2, 6)}`);

  expect((await login(portalEmail, 'staff')).status()).toBe(401); // firma girişiyle portal hesabı açılmaz
  const r = await login(portalEmail, 'portal');
  expect(r.status(), await r.text()).toBe(200);
  const { token, user } = await r.json();
  expect(user).toMatchObject({ type: 'portal', email: portalEmail });

  expect((await anon.get('/api/mobile/auth/me', { headers: auth(token) })).status()).toBe(200);
  expect((await anon.get('/api/portal/me/orders', { headers: auth(token) })).status()).toBe(200);
  expect((await anon.get('/api/customers', { headers: auth(token) })).status()).toBe(403);

  await prisma.portalCustomer.updateMany({ where: { email: portalEmail }, data: { isActive: false } });
  expect((await anon.get('/api/mobile/auth/me', { headers: auth(token) })).status()).toBe(401);
});

test('Bearer varsa oturumu token belirler; cihazda kalmış eski çerez dikkate alınmaz', async () => {
  // Uygulamada eski bir oturum çerezi kalsa bile istek token'ın hesabıyla çalışır
  // (önceden çerez kazanıyordu ve mobilde başka firmanın verisi görünebiliyordu).
  // Tarayıcı Bearer başlığını kendiliğinden eklemediği için web oturumları etkilenmez.
  const tokenB = await tokenFor(B.ownerEmail);
  const me = await A.owner.get('/api/mobile/auth/me', { headers: auth(tokenB) });
  expect(me.status()).toBe(200);
  expect((await me.json()).user.email).toBe(B.ownerEmail);
  // Token olmadan aynı istemci kendi (A) oturumuyla devam eder
  expect((await (await A.owner.get('/api/mobile/auth/me')).json()).user.email).toBe(A.ownerEmail);
});

test('gizlilik ve destek sayfaları oturumsuz açılır', async () => {
  const p = await anon.get('/gizlilik');
  expect(p.status()).toBe(200);
  expect(await p.text()).toContain('KVKK');
  const d = await anon.get('/destek');
  expect(d.status()).toBe(200);
  expect(await d.text()).toContain('Hesabımı ve verilerimi nasıl silerim?');
  // Mağazaların istediği herkese açık hesap silme sayfası
  const h = await anon.get('/hesap-silme');
  expect(h.status()).toBe(200);
  const html = await h.text();
  expect(html).toContain('Hesabı sil');
  expect(html).toContain('15 gün');
  expect(await p.text()).toContain('/hesap-silme');
});
