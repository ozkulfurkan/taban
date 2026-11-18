import { test, expect, APIRequestContext, request as pwRequest } from '@playwright/test';
import { prisma, RUN, BASE_URL, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Hesap ekstresini link ile paylaşma: link oluşturma/yenileme/kapatma, oturumsuz görüntüleme,
// firma ayrımı ve roller.

let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let anon: APIRequestContext;

test.beforeAll(async () => {
  A = await createCompany('ekstre-link');
  B = await createCompany('ekstre-link-b');
  await prisma.company.update({ where: { id: A.companyId }, data: { phone: '0212 555 00 00', address: 'Test Cad. 1', taxId: '1234567890' } });
  anon = await pwRequest.newContext({ baseURL: BASE_URL });
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

const uniq = (p: string) => `${p} ${RUN} ${Math.random().toString(36).slice(2, 7)}`;
const tokenOf = (url: string) => url.split('/ekstre/')[1];
const pub = (token: string, q = '') => anon.get(`/api/public/statement/${token}${q}`);

async function customer(owner: APIRequestContext, currency = 'USD') {
  const r = await owner.post('/api/customers', { data: { name: uniq('Paylaşım Müşteri'), currency, phone: '0532 111 22 33' } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function link(owner: APIRequestContext, data: any) {
  const r = await owner.post('/api/statement-links', { data });
  expect([200, 201], await r.text()).toContain(r.status());
  return (await r.json()).link as { url: string; viewCount: number };
}

test('link oluşturma idempotent; yenileyince eski link 404, kapatınca yenisi de 404', async () => {
  const cus = await customer(A.owner);
  const first = await A.owner.post('/api/statement-links', { data: { customerId: cus.id } });
  expect(first.status()).toBe(201);
  const l1 = (await first.json()).link;
  expect(l1.url).toMatch(/\/ekstre\/[A-Za-z0-9_-]{43}$/);

  const again = await link(A.owner, { customerId: cus.id });
  expect(again.url).toBe(l1.url);
  const got = await (await A.owner.get(`/api/statement-links?customerId=${cus.id}`)).json();
  expect(got.link.url).toBe(l1.url);

  expect((await pub(tokenOf(l1.url))).status()).toBe(200);

  const l2 = await link(A.owner, { customerId: cus.id, regenerate: true });
  expect(l2.url).not.toBe(l1.url);
  expect((await pub(tokenOf(l1.url))).status()).toBe(404);
  expect((await pub(tokenOf(l2.url))).status()).toBe(200);
  expect(await prisma.statementShareLink.count({ where: { customerId: cus.id, revokedAt: null } })).toBe(1);

  const del = await A.owner.delete(`/api/statement-links?customerId=${cus.id}`);
  expect(del.status()).toBe(200);
  expect((await pub(tokenOf(l2.url))).status()).toBe(404);
  expect((await (await A.owner.get(`/api/statement-links?customerId=${cus.id}`)).json()).link).toBeNull();
});

test('açık ekstre: cari, firma ve kalem bilgisi döner; iç kimlik dönmez; görüntülenme sayılır', async () => {
  const cus = await customer(A.owner, 'USD');
  const inv = await A.owner.post('/api/invoices', {
    data: { customerId: cus.id, items: [{ description: 'Kauçuk taban', quantity: 4, unitPrice: 12.5 }] },
  });
  expect(inv.ok(), await inv.text()).toBeTruthy();
  const pay = await A.owner.post('/api/payments', {
    data: { type: 'RECEIVED', customerId: cus.id, amount: 20, currency: 'USD', method: 'Nakit' },
  });
  expect(pay.ok(), await pay.text()).toBeTruthy();

  const l = await link(A.owner, { customerId: cus.id });
  const r = await pub(tokenOf(l.url));
  expect(r.status()).toBe(200);
  expect(r.headers()['cache-control']).toContain('no-store');
  expect(r.headers()['x-robots-tag']).toContain('noindex');
  const d = await r.json();
  expect(d.kind).toBe('customer');
  expect(d.party).toEqual({ name: cus.name, currency: 'USD' });
  expect(d.company).toMatchObject({ phone: '0212 555 00 00', address: 'Test Cad. 1', taxId: '1234567890' });
  expect(d.invoices).toHaveLength(1);
  expect(d.invoices[0].items[0]).toMatchObject({ description: 'Kauçuk taban', quantity: 4, unitPrice: 12.5 });
  expect(d.payments).toHaveLength(1);

  const text = JSON.stringify(d);
  expect(text).not.toContain(A.companyId);
  expect(text).not.toContain(cus.id);
  expect(text).not.toContain('companyId');
  expect(text).not.toContain('customerId');

  await pub(tokenOf(l.url));
  const after = await (await A.owner.get(`/api/statement-links?customerId=${cus.id}`)).json();
  expect(after.link.viewCount).toBe(2);
  expect(after.link.lastViewedAt).toBeTruthy();

  // Tarih aralığı dışında hareket yok
  const empty = await (await pub(tokenOf(l.url), '?from=2000-01-01&to=2000-12-31')).json();
  expect(empty.invoices).toHaveLength(0);
  expect(empty.payments).toHaveLength(0);
});

test('tedarikçi ekstresi alış kalemleriyle paylaşılır', async () => {
  const sup = await (await A.owner.post('/api/suppliers', { data: { name: uniq('Paylaşım Ted'), currency: 'USD' } })).json();
  const mat = await (await A.owner.post('/api/materials', { data: { name: uniq('Hammadde'), pricePerKg: 3, currency: 'USD' } })).json();
  const p = await A.owner.post('/api/purchases', { data: { supplierId: sup.id, items: [{ materialId: mat.id, qty: 10, unitPrice: 3 }] } });
  expect(p.ok(), await p.text()).toBeTruthy();

  const l = await link(A.owner, { supplierId: sup.id });
  const d = await (await pub(tokenOf(l.url))).json();
  expect(d.kind).toBe('supplier');
  expect(d.party.currency).toBe('USD');
  expect(d.purchases).toHaveLength(1);
  expect(d.purchases[0].total).toBe(30);
  expect(d.purchases[0].items[0]).toMatchObject({ description: mat.name, quantity: 10, unitPrice: 3, total: 30 });
  expect(JSON.stringify(d)).not.toContain(sup.id);
});

test('başka firmanın carisi için link oluşturulamaz, görülemez, kapatılamaz', async () => {
  const cus = await customer(A.owner);
  const l = await link(A.owner, { customerId: cus.id });
  expect((await B.owner.post('/api/statement-links', { data: { customerId: cus.id } })).status()).toBe(404);
  expect((await B.owner.get(`/api/statement-links?customerId=${cus.id}`)).status()).toBe(404);
  expect((await B.owner.delete(`/api/statement-links?customerId=${cus.id}`)).status()).toBe(404);
  expect((await pub(tokenOf(l.url))).status()).toBe(200);
});

test('roller: görüntüleyici linki görür ama oluşturamaz; düzenleyici yenileyip kapatabilir; oturumsuz yönetemez', async () => {
  const cus = await customer(A.owner);
  await link(A.owner, { customerId: cus.id });
  const viewer = await loggedIn(await createUser(A.companyId, `viewer-link-${Math.random().toString(36).slice(2, 6)}`, 'VIEWER'));
  expect((await viewer.get(`/api/statement-links?customerId=${cus.id}`)).status()).toBe(200);
  expect((await viewer.post('/api/statement-links', { data: { customerId: cus.id, regenerate: true } })).status()).toBe(403);
  expect((await viewer.delete(`/api/statement-links?customerId=${cus.id}`)).status()).toBe(403);

  const editor = await loggedIn(await createUser(A.companyId, `editor-link-${Math.random().toString(36).slice(2, 6)}`, 'EDITOR'));
  expect((await editor.post('/api/statement-links', { data: { customerId: cus.id, regenerate: true } })).status()).toBe(201);
  expect((await editor.delete(`/api/statement-links?customerId=${cus.id}`)).status()).toBe(200);

  expect((await anon.post('/api/statement-links', { data: { customerId: cus.id } })).status()).toBe(401);
  expect((await anon.get(`/api/statement-links?customerId=${cus.id}`)).status()).toBe(401);
});

test('geçersiz istekler: biçimsiz token, hiç olmayan token, eksik cari', async () => {
  expect((await pub('abc')).status()).toBe(404);
  expect((await pub('A'.repeat(43))).status()).toBe(404);
  expect((await A.owner.post('/api/statement-links', { data: {} })).status()).toBe(400);
  const cus = await customer(A.owner);
  const sup = await (await A.owner.post('/api/suppliers', { data: { name: uniq('Ted') } })).json();
  expect((await A.owner.post('/api/statement-links', { data: { customerId: cus.id, supplierId: sup.id } })).status()).toBe(400);
});
