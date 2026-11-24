import { test, expect, APIRequestContext } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { prisma, PASSWORD, RUN, createCompany, createUser, loggedIn, login, newClient, cleanup } from './helpers';

// Müşteri portalından gelen sipariş süreci: müşteriler ve firmalar arası ayrım, katalog görünürlüğü,
// yanıt alanları, sipariş doğrulama ve firma tarafı işlem kuralları.
// test.fixme olanlar docs/PORTAL-DENETIM.md'deki açık bulgulardır (kod parantezde); düzeltilince açılır.

type Co = { companyId: string; owner: APIRequestContext };
let A: Co; let B: Co;
let custA1: string; let custA2: string; let custB: string;
let pcA1: string; let pcA2: string;
let M1: APIRequestContext; let M2: APIRequestContext; let MB: APIRequestContext;
let pubA: string; let hiddenA: string; let privateA2: string; let pubB: string;
let orderM2: string; let orderMB: string;

async function portal(companyId: string, customerId: string, tag: string) {
  const email = `sec-po-${tag}-${RUN}@test.local`;
  const pc = await prisma.portalCustomer.create({ data: { email, companyId, customerId, emailVerified: true, password: await bcrypt.hash(PASSWORD, 10) } });
  return { id: pc.id, email, api: await loggedIn(email, PASSWORD, 'portal-credentials') };
}

test.beforeAll(async () => {
  A = await createCompany('po-a');
  B = await createCompany('po-b');
  custA1 = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri A1 ${RUN}` } })).id;
  custA2 = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri A2 ${RUN}` } })).id;
  custB = (await prisma.customer.create({ data: { companyId: B.companyId, name: `Müşteri B ${RUN}` } })).id;
  const mat = await prisma.material.create({ data: { companyId: A.companyId, name: `HM ${RUN}`, pricePerKg: 7.77 } });
  const mk = async (companyId: string, name: string, portalVisible: boolean) => (await prisma.product.create({
    data: {
      companyId, name: `${name} ${RUN}`, code: name, unitPrice: 9.99, laborCostPerPair: 3.33, notes: 'GİZLİ NOT', portalVisible, sizes: ['38', '39', '40'],
      parts: { create: [{ name: 'Gövde', materialId: companyId === A.companyId ? mat.id : null, gramsPerPiece: 222, wasteRate: 5 }] },
    },
  })).id;
  pubA = await mk(A.companyId, 'PUB-A', true);
  hiddenA = await mk(A.companyId, 'HID-A', false);
  privateA2 = await mk(A.companyId, 'PRV-A2', true);
  pubB = await mk(B.companyId, 'PUB-B', true);
  const m1 = await portal(A.companyId, custA1, 'm1'); M1 = m1.api; pcA1 = m1.id;
  const m2 = await portal(A.companyId, custA2, 'm2'); M2 = m2.api; pcA2 = m2.id;
  MB = (await portal(B.companyId, custB, 'mb')).api;
  // PRV-A2 yalnızca M2'ye özel
  await prisma.productPortalCustomer.create({ data: { productId: privateA2, portalCustomerId: pcA2 } });
  const r2 = await M2.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '40': 10 } } });
  orderM2 = (await r2.json()).id;
  const rb = await MB.post('/api/portal/me/orders', { data: { productId: pubB, sizeDistribution: { '40': 10 } } });
  orderMB = (await rb.json()).id;
});
test.afterAll(async () => { await cleanup(); });

test('müşteri yalnızca kendi kataloğunu görür (gizli, başka müşteriye özel ve başka firmanın ürünü yok)', async () => {
  const cat = await (await M1.get('/api/portal/me/catalog')).json();
  const ids = cat.map((p: any) => p.id);
  expect(ids).toContain(pubA);
  for (const id of [hiddenA, privateA2, pubB]) expect(ids, id).not.toContain(id);
  const cat2 = (await (await M2.get('/api/portal/me/catalog')).json()).map((p: any) => p.id);
  expect(cat2).toContain(privateA2);
  for (const id of [hiddenA, privateA2, pubB]) expect((await M1.get(`/api/portal/me/catalog/${id}/image`)).status(), id).toBe(404);
});

test('katalog yanıtı fiyat/maliyet/reçete ve iç notları içermez', async () => {
  const body = JSON.stringify(await (await M1.get('/api/portal/me/catalog')).json());
  for (const s of ['9.99', '3.33', '7.77', '222', 'GİZLİ NOT', 'unitPrice', 'laborCostPerPair', 'gramsPerPiece', 'companyId']) {
    expect(body, `katalogda "${s}" olmamalı`).not.toContain(s);
  }
});

test('müşteri başka müşterinin ve başka firmanın siparişini göremez', async () => {
  const list = await (await M1.get('/api/portal/me/orders')).json();
  expect(list.map((o: any) => o.id)).not.toContain(orderM2);
  for (const id of [orderM2, orderMB]) expect((await M1.get(`/api/portal/me/orders/${id}`)).status(), id).toBe(404);
  const own = await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '39': 5 } } });
  expect(own.status()).toBe(201);
  const body = JSON.stringify(await (await M1.get(`/api/portal/me/orders/${(await own.json()).id}`)).json());
  for (const s of ['9.99', '3.33', 'GİZLİ NOT', 'companyId', 'customerId', 'portalCustomerId']) expect(body, `sipariş yanıtında "${s}" olmamalı`).not.toContain(s);
});

test('müşteri katalog dışı, gizli, başkasına özel ya da başka firmanın ürününü sipariş edemez; başkası adına sipariş açamaz', async () => {
  for (const productId of [hiddenA, privateA2, pubB]) {
    const r = await M1.post('/api/portal/me/orders', { data: { productId, sizeDistribution: { '40': 1 } } });
    expect(r.status(), productId).toBe(404);
    const r2 = await M1.post('/api/portal/me/orders', { data: { orderItems: [{ productId, sizeDistribution: { '40': 1 } }] } });
    expect(r2.status(), `paket ${productId}`).toBe(404);
  }
  const r = await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '40': 1 }, customerId: custA2, companyId: B.companyId, portalCustomerId: pcA2 } });
  expect(r.status()).toBe(201);
  const o = await prisma.soleOrder.findUniqueOrThrow({ where: { id: (await r.json()).id } });
  expect([o.companyId, o.customerId, o.portalCustomerId]).toEqual([A.companyId, custA1, pcA1]);
});

test('müşteri portalı firma API\'lerine erişemez', async () => {
  for (const url of ['/api/orders', `/api/orders/${orderM2}`, '/api/products', '/api/customers', '/api/portal/orders', '/api/portal/customers', '/api/portal/catalog', '/api/company', '/api/portal/fason/orders']) {
    const s = (await M1.get(url)).status();
    expect([401, 403, 404], `müşteri → ${url} = ${s}`).toContain(s);
  }
  expect((await M1.put(`/api/orders/${orderM2}`, { data: { status: 'CANCELLED' } })).status()).not.toBe(200);
});

test('firma başka firmanın siparişini ve portal müşterisini göremez/değiştiremez', async () => {
  expect((await A.owner.get(`/api/orders/${orderMB}`)).status()).toBe(404);
  expect((await A.owner.put(`/api/orders/${orderMB}`, { data: { status: 'CANCELLED' } })).status()).toBe(404);
  expect((await A.owner.post(`/api/orders/${orderMB}/confirm`, { data: {} })).status()).toBe(404);
  expect((await A.owner.delete(`/api/orders/${orderMB}`)).status()).toBe(404);
  const list = await (await A.owner.get('/api/portal/orders')).json();
  expect(JSON.stringify(list)).not.toContain(orderMB);
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id: orderMB } })).status).toBe('ORDER_RECEIVED');
});

// P-H1, P-H2
test.fixme('sipariş girdi doğrulama: negatif/ondalık/metin adet, geçersiz termin', async () => {
  const cases: [string, any][] = [
    ['negatif adet', { productId: pubA, sizeDistribution: { '39': -5, '40': 10 } }],
    ['ondalık adet', { productId: pubA, sizeDistribution: { '40': 2.5 } }],
    ['metin adet', { productId: pubA, sizeDistribution: { '40': 'on' } }],
    ['geçersiz termin', { productId: pubA, sizeDistribution: { '40': 1 }, requestedDeliveryDate: 'yarın' }],
  ];
  for (const [name, data] of cases) {
    const s = (await M1.post('/api/portal/me/orders', { data })).status();
    expect(s, `${name} → ${s}`).toBe(400);
  }
});

test('pasif portal hesabı ve şifresi değişen hesabın eski oturumu kapanır', async () => {
  const x = await (async () => { const c = (await prisma.customer.create({ data: { companyId: A.companyId, name: `X ${RUN}` } })).id; return portal(A.companyId, c, 'x'); })();
  expect((await x.api.get('/api/portal/me/orders')).status()).toBe(200);
  await prisma.portalCustomer.update({ where: { id: x.id }, data: { isActive: false } });
  expect((await x.api.get('/api/portal/me/orders')).status()).not.toBe(200);
  const fresh = await newClient();
  const { session } = await login(fresh, x.email, PASSWORD, 'portal-credentials');
  expect(session?.user ?? null).toBeNull();
  await fresh.dispose();
});

// P-H4
test.fixme('firma: durum geçişleri; iptal edilen ilerletilemez, sevk edilen geri alınamaz', async () => {
  const r = await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '40': 3 } } });
  const id = (await r.json()).id;
  expect((await A.owner.put(`/api/orders/${id}`, { data: { status: 'CANCELLED' } })).status()).toBe(200);
  const revive = await A.owner.put(`/api/orders/${id}`, { data: { status: 'IN_PRODUCTION' } });
  expect(revive.status(), 'iptal edilen sipariş üretime alınmamalı').toBe(400);
});

// P-G1
test.fixme('firma: "sipariş" izni olmayan EDITOR siparişleri okuyamaz; VIEWER değiştiremez', async () => {
  const editor = await loggedIn(await createUser(A.companyId, 'po-editor', 'EDITOR', ['products']));
  const s = (await editor.get('/api/orders')).status();
  expect([401, 403], `sipariş izni olmayan EDITOR → /api/orders = ${s}`).toContain(s);
  const viewer = await loggedIn(await createUser(A.companyId, 'po-viewer', 'VIEWER'));
  expect((await viewer.put(`/api/orders/${orderM2}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(403);
  await editor.dispose(); await viewer.dispose();
});
