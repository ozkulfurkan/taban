import { test, expect, APIRequestContext } from '@playwright/test';
import {
  prisma, PASSWORD, RUN, createCompany, createUser, createPortalCustomer, loggedIn, newClient, cleanup,
} from '../security/helpers';
import bcrypt from 'bcryptjs';

// Mobil ayarlar: şifre değiştirme, firma logosu, portal hesabı açma ve davet sayfası.

let A: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;
const uid = () => Math.random().toString(36).slice(2, 7);
// 1×1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

test.beforeAll(async () => {
  A = await createCompany('ayar');
  anon = await newClient();
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

test('şifre değiştirme: yanlış mevcut şifre ve zayıf şifre reddedilir; başarılıysa eski oturum düşer, yeni şifre çalışır', async () => {
  const email = await createUser(A.companyId, `sifre-${uid()}`, 'EDITOR');
  const web = await loggedIn(email);
  const other = await loggedIn(email); // başka cihazdaki oturum

  expect((await web.post('/api/account/password', { data: { currentPassword: 'yanlis1', newPassword: 'YeniSifre1' } })).status()).toBe(400);
  expect((await web.post('/api/account/password', { data: { currentPassword: PASSWORD, newPassword: 'kisa' } })).status()).toBe(400);
  expect((await web.post('/api/account/password', { data: { currentPassword: PASSWORD, newPassword: PASSWORD } })).status()).toBe(400);

  await new Promise(r => setTimeout(r, 1100));
  const ok = await web.post('/api/account/password', { data: { currentPassword: PASSWORD, newPassword: 'YeniSifre1' } });
  expect(ok.status(), await ok.text()).toBe(200);
  expect((await other.get('/api/customers')).status()).toBe(401);
  const fresh = await loggedIn(email, 'YeniSifre1');
  expect((await fresh.get('/api/customers')).status()).toBe(200);
  await Promise.all([web.dispose(), other.dispose(), fresh.dispose()]);
});

test('mobil şifre değiştirme yeni token döner; eski token geçersiz olur', async () => {
  const email = await createUser(A.companyId, `mobil-sifre-${uid()}`, 'EDITOR');
  const login = await anon.post('/api/mobile/auth/login', { data: { email, password: PASSWORD, kind: 'staff' } });
  const old = { Authorization: `Bearer ${(await login.json()).token}` };
  await new Promise(r => setTimeout(r, 1100));
  const r = await anon.post('/api/account/password', { headers: old, data: { currentPassword: PASSWORD, newPassword: 'MobilSifre9' } });
  expect(r.status(), await r.text()).toBe(200);
  const { token } = await r.json();
  expect(typeof token).toBe('string');
  expect((await anon.get('/api/customers', { headers: old })).status()).toBe(401);
  expect((await anon.get('/api/customers', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
});

test('portal müşterisi kendi şifresini değiştirebilir (mobil ve web); diğer firmadaki aynı e-postalı hesap etkilenmez', async () => {
  const B = await createCompany('ayar-b');
  const ca = await prisma.customer.create({ data: { companyId: A.companyId, name: `Şifre Portal A ${RUN}` } });
  const cb = await prisma.customer.create({ data: { companyId: B.companyId, name: `Şifre Portal B ${RUN}` } });
  const email = `sec-psifre-${uid()}-${RUN}@test.local`;
  await createPortalCustomer(ca.id, 'psifre-a', email, 'EskiSifreA1');
  await createPortalCustomer(cb.id, 'psifre-b', email, 'EskiSifreB1');

  // Mobil: yetki hatası yok, yeni token döner
  const login = await anon.post('/api/mobile/auth/login', { data: { email, password: 'EskiSifreA1', kind: 'portal' } });
  expect(login.status(), await login.text()).toBe(200);
  const r = await anon.post('/api/account/password', {
    headers: { Authorization: `Bearer ${(await login.json()).token}` },
    data: { currentPassword: 'EskiSifreA1', newPassword: 'YeniSifreA2' },
  });
  expect(r.status(), await r.text()).toBe(200);
  expect(typeof (await r.json()).token).toBe('string');

  // B'deki hesabın şifresi değişmedi
  const pcB = await prisma.portalCustomer.findFirstOrThrow({ where: { email, companyId: B.companyId } });
  expect(await bcrypt.compare('EskiSifreB1', pcB.password)).toBe(true);

  // Web portal oturumu da değiştirebilir
  const web = await loggedIn(email, 'EskiSifreB1', 'portal-credentials');
  await new Promise(res => setTimeout(res, 1100));
  expect((await web.post('/api/account/password', { data: { currentPassword: 'EskiSifreB1', newPassword: 'YeniSifreB2' } })).status()).toBe(200);
  await web.dispose();
});

test('firma logosu: yalnızca sahip yükler; PNG kabul, SVG ve bozuk veri reddedilir; kaldırılabilir', async () => {
  const editor = await loggedIn(await createUser(A.companyId, `logo-ed-${uid()}`, 'EDITOR'));
  expect((await editor.put('/api/company/logo', { data: { data: PNG } })).status()).toBe(403);

  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
  expect((await A.owner.put('/api/company/logo', { data: { data: svg } })).status()).toBe(400);
  expect((await A.owner.put('/api/company', { data: { logoUrl: svg } })).status()).toBe(400);
  expect((await A.owner.put('/api/company/logo', { data: { data: 'bozuk!!' } })).status()).toBe(400);

  const ok = await A.owner.put('/api/company/logo', { data: { data: PNG } });
  expect(ok.status(), await ok.text()).toBe(200);
  const saved = (await prisma.company.findUniqueOrThrow({ where: { id: A.companyId } })).logoUrl;
  expect(saved).toMatch(/^data:image\/png;base64,/);
  // Aynı logo ile diğer firma bilgileri kaydedilebilir
  expect((await A.owner.put('/api/company', { data: { logoUrl: saved, phone: '0212 000' } })).status()).toBe(200);

  expect((await A.owner.delete('/api/company/logo')).status()).toBe(200);
  expect((await prisma.company.findUniqueOrThrow({ where: { id: A.companyId } })).logoUrl).toBeNull();
  await editor.dispose();
});

test('portal hesabı: görüntüleyici açamaz, zayıf şifre ve ikinci hesap reddedilir', async () => {
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Portal Cari ${RUN}` } });
  const viewer = await loggedIn(await createUser(A.companyId, `portal-v-${uid()}`, 'VIEWER'));
  const body = (email: string, password = 'Portal123') => ({ data: { customerId: cust.id, email, password } });

  expect((await viewer.post('/api/portal/auth/register', body(`v-${uid()}@test.local`))).status()).toBe(403);
  expect((await A.owner.post('/api/portal/auth/register', body(`w-${uid()}@test.local`, '123'))).status()).toBe(400);
  const ok = await A.owner.post('/api/portal/auth/register', body(`sec-portal-${uid()}-${RUN}@test.local`));
  expect(ok.status(), await ok.text()).toBe(201);
  expect((await A.owner.post('/api/portal/auth/register', body(`x-${uid()}@test.local`))).status()).toBe(400);

  const pc = await prisma.portalCustomer.findUniqueOrThrow({ where: { customerId: cust.id } });
  expect((await viewer.put(`/api/portal/customers/${pc.id}`, { data: { isActive: false } })).status()).toBe(403);
  expect((await A.owner.put(`/api/portal/customers/${pc.id}`, { data: { newPassword: '12' } })).status()).toBe(400);
  await viewer.dispose();
});

test('davet sayfası herkese açık; web girişi bağlantısı var', async () => {
  const r = await anon.get('/indir');
  expect(r.status()).toBe(200);
  const html = await r.text();
  expect(html).toContain('/portal/login');
  expect(html).toContain('SoleCost');
  expect(html).toContain('apps.apple.com/tr/app/solecost/id6836669345');
  // iPhone'dan açılınca doğrudan App Store'a gider
  const ios = await anon.get('/indir', { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }, maxRedirects: 0 });
  expect([307, 308]).toContain(ios.status());
  expect(ios.headers()['location']).toContain('apps.apple.com/tr/app/solecost/id6836669345');
  // Tanıtım ve giriş sayfalarında App Store bağlantısı
  for (const path of ['/', '/login', '/portal/login']) {
    expect(await (await anon.get(path)).text(), path).toContain('id6836669345');
  }
});
