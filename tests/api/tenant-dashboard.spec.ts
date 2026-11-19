import { test, expect, APIRequestContext, request as pwRequest } from '@playwright/test';
import { prisma, RUN, BASE_URL, PASSWORD, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Panel ve listeler yalnızca oturumdaki firmanın verisini gösterir:
// - platform yöneticisi (ADMIN) de uygulama içinde yalnızca kendi firmasını görür
// - mobil uygulamada Bearer token, cihazda kalmış başka bir oturum çerezinden önce gelir

let A: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let B: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;

test.beforeAll(async () => {
  A = await createCompany('panel-a') as any;
  B = await createCompany('panel-b') as any;
  anon = await pwRequest.newContext({ baseURL: BASE_URL });
  // B'de hammadde, hesaplama ve vadesi yaklaşan çek
  await prisma.material.create({ data: { companyId: B.companyId, name: `B Hammadde ${RUN}`, pricePerKg: 1, stock: -5 } });
  const bCus = await prisma.customer.create({ data: { companyId: B.companyId, name: `B Müşteri ${RUN}` } });
  await prisma.cek.create({
    data: {
      companyId: B.companyId, customerId: bCus.id, borclu: 'B Borçlu', tutar: 1000, currency: 'TRY',
      vadesi: new Date(Date.now() + 5 * 24 * 3600 * 1000), durum: 'PORTFOY', islem: 'Müşteriden Alınan Çek Kaydı',
    } as any,
  });
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

const bearer = async (userEmail: string) => {
  const r = await anon.post('/api/mobile/auth/login', { data: { email: userEmail, password: PASSWORD } });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).token as string;
};

test('platform yöneticisi panelde ve listelerde başka firmanın verisini görmez', async () => {
  const adminEmail = await createUser(A.companyId, 'panel-admin', 'EDITOR');
  await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
  const admin = await loggedIn(adminEmail);
  const d = await (await admin.get('/api/dashboard')).json();
  expect(d.materialCount).toBe(0);
  expect(d.upcomingChecks).toEqual([]);
  expect(d.assets.cek).toBe(0);
  expect(d.negativeStock.materials).toEqual([]);
  expect(await (await admin.get('/api/materials')).json()).toEqual([]);
  expect(await (await admin.get('/api/calculations')).json()).toEqual([]);

  // B'nin hammaddesine ADMIN de doğrudan erişemez
  const bMat = await prisma.material.findFirst({ where: { companyId: B.companyId } });
  expect((await admin.put(`/api/materials/${bMat!.id}`, { data: { name: 'x', pricePerKg: 1 } })).status()).not.toBe(200);
  expect((await prisma.material.findUnique({ where: { id: bMat!.id } }))!.name).toBe(`B Hammadde ${RUN}`);

  // Mobil (Bearer) aynı
  const tA = await bearer(adminEmail);
  const md = await (await anon.get('/api/dashboard', { headers: { Authorization: `Bearer ${tA}` } })).json();
  expect(md.upcomingChecks).toEqual([]);
  expect(md.materialCount).toBe(0);
  await admin.dispose();
});

test('mobil: Bearer token, cihazda kalmış başka firmanın oturum çerezinden önce gelir', async () => {
  const tA = await bearer(A.ownerEmail);
  // B oturumunun çerezleri olan bir istemci (cihazda kalmış eski oturum gibi) + A'nın token'ı
  const bCookies = B.owner;
  const d = await (await bCookies.get('/api/dashboard', { headers: { Authorization: `Bearer ${tA}` } })).json();
  expect(d.upcomingChecks).toEqual([]);
  expect(d.negativeStock.materials).toEqual([]);
  // Token olmadan aynı istemci B'yi görür (web oturumu bozulmadı)
  const dB = await (await bCookies.get('/api/dashboard')).json();
  expect(dB.upcomingChecks.length).toBe(1);
  expect(dB.negativeStock.materials.length).toBe(1);
});
