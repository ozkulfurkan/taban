import { test, expect, APIRequestContext } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { prisma, PASSWORD, RUN, createCompany, createUser, loggedIn, newClient, cleanup } from './helpers';

// Fasoncu ve fason portalı: firma ayrımı, fasoncular arası ayrım, portal türleri ve yanıt alanları.
// Bulgu kodları (G1, H3 …) docs/FASON-DENETIM.md'dedir.

type Co = { companyId: string; owner: APIRequestContext };
let A: Co; let B: Co;
let subA1: string; let subA2: string; let subB: string;
let orderA1: string; let orderA2: string; let orderB: string;
let matA: string; let matB: string; let prodA: string;
let fasonA1: APIRequestContext; let fasonB: APIRequestContext; let customerPortalA: APIRequestContext;

async function fasonPortal(companyId: string, subcontractorId: string, name: string) {
  const email = `sec-fason-${name}-${RUN}@test.local`;
  const pc = await prisma.portalCustomer.create({
    data: { email, companyId, portalType: 'SUBCONTRACTOR', emailVerified: true, password: await bcrypt.hash(PASSWORD, 10) },
  });
  await prisma.subcontractor.update({ where: { id: subcontractorId }, data: { portalCustomerId: pc.id } });
  return loggedIn(email, PASSWORD, 'portal-credentials');
}

async function setup(companyId: string, tag: string) {
  const mat = await prisma.material.create({ data: { companyId, name: `HM ${tag} ${RUN}`, pricePerKg: 7.77, stock: 500 } });
  const prod = await prisma.product.create({
    data: {
      companyId, name: `Fason Taban ${tag} ${RUN}`, code: `F-${tag}`, unitPrice: 9.99, laborCostPerPair: 3.33, notes: `GİZLİ NOT ${tag}`,
      parts: { create: [{ name: 'Gövde', materialId: mat.id, gramsPerPiece: 200, wasteRate: 5 }] },
    },
  });
  const cust = await prisma.customer.create({ data: { companyId, name: `Müşteri ${tag} ${RUN}` } });
  return { mat: mat.id, prod: prod.id, cust: cust.id };
}

test.beforeAll(async () => {
  A = await createCompany('fason-a');
  B = await createCompany('fason-b');
  const a = await setup(A.companyId, 'A'); const b = await setup(B.companyId, 'B');
  matA = a.mat; matB = b.mat; prodA = a.prod;
  subA1 = (await prisma.subcontractor.create({ data: { companyId: A.companyId, name: `Atölye A1 ${RUN}` } })).id;
  subA2 = (await prisma.subcontractor.create({ data: { companyId: A.companyId, name: `Atölye A2 ${RUN}` } })).id;
  subB = (await prisma.subcontractor.create({ data: { companyId: B.companyId, name: `Atölye B ${RUN}` } })).id;
  const mk = async (companyId: string, subcontractorId: string, productId: string, no: string) => (await prisma.subcontractorOrder.create({
    data: { companyId, subcontractorId, productId, orderNo: `${no}-${RUN}`, sizeDistribution: { '40': 100 }, totalPairs: 100, status: 'MATERIAL_SENT' },
  })).id;
  orderA1 = await mk(A.companyId, subA1, a.prod, 'FA1');
  orderA2 = await mk(A.companyId, subA2, a.prod, 'FA2');
  orderB = await mk(B.companyId, subB, b.prod, 'FB');
  await prisma.subcontractorStock.create({ data: { subcontractorId: subA1, materialId: matA, quantity: 10 } });
  await prisma.subcontractorStock.create({ data: { subcontractorId: subA2, materialId: matA, quantity: 20 } });
  await prisma.subcontractorStock.create({ data: { subcontractorId: subB, materialId: matB, quantity: 30 } });
  fasonA1 = await fasonPortal(A.companyId, subA1, 'a1');
  await fasonPortal(A.companyId, subA2, 'a2');
  fasonB = await fasonPortal(B.companyId, subB, 'b');
  const cpEmail = `sec-fason-musteri-${RUN}@test.local`;
  await prisma.portalCustomer.create({ data: { email: cpEmail, companyId: A.companyId, customerId: a.cust, emailVerified: true, password: await bcrypt.hash(PASSWORD, 10) } });
  customerPortalA = await loggedIn(cpEmail, PASSWORD, 'portal-credentials');
});
test.afterAll(async () => { await cleanup(); });

test('firma: başka firmanın fasoncusu, fason siparişi ve zimmeti okunamaz/değiştirilemez', async () => {
  for (const url of [`/api/subcontractors/${subB}`, `/api/subcontractor-orders/${orderB}`, `/api/subcontractor-orders/${orderB}/material-requirements`]) {
    expect((await A.owner.get(url)).status(), url).toBe(404);
  }
  expect(await (await A.owner.get(`/api/subcontractors/${subB}/stock`)).json()).toEqual([]);
  expect((await A.owner.put(`/api/subcontractors/${subB}`, { data: { name: 'ele geçirildi' } })).status()).toBe(404);
  expect((await A.owner.put(`/api/subcontractor-orders/${orderB}`, { data: { status: 'CANCELLED' } })).status()).toBe(404);
  expect((await A.owner.post(`/api/subcontractor-orders/${orderB}/material-transfer`, { data: { materialId: matA, quantity: 1 } })).status()).toBe(404);
  expect((await A.owner.post(`/api/subcontractor-orders/${orderA1}/material-transfer`, { data: { materialId: matB, quantity: 1 } })).status()).toBe(404);
  expect((await A.owner.post(`/api/subcontractor-orders/${orderB}/receive-products`, { data: { receivedPairs: 1 } })).status()).toBe(404);
  expect((await A.owner.post(`/api/subcontractor-orders/${orderB}/send-email`)).status()).toBe(404);
  expect((await A.owner.post(`/api/subcontractors/${subB}/portal-register`, { data: { email: 'x@y.z', password: 'Abc12345!' } })).status()).toBe(404);
  expect((await A.owner.post('/api/subcontractor-orders', { data: { subcontractorId: subB, sizeDistribution: { '40': 1 } } })).status()).toBe(404);
  expect((await A.owner.delete(`/api/subcontractors/${subB}`)).status()).toBe(404);
  const listA = await (await A.owner.get(`/api/subcontractor-orders?subcontractorId=${subB}`)).json();
  expect(listA).toEqual([]);
  expect((await prisma.subcontractor.findUniqueOrThrow({ where: { id: subB } })).name).toContain('Atölye B');
  expect((await prisma.subcontractorOrder.findUniqueOrThrow({ where: { id: orderB } })).status).toBe('MATERIAL_SENT');
});

test('fasoncu portalı: yalnızca kendi siparişleri ve zimmeti; başka fasoncu/firma kapalı', async () => {
  const list = await (await fasonA1.get('/api/portal/fason/orders')).json();
  expect(list.map((o: any) => o.id)).toEqual([orderA1]);
  for (const id of [orderA2, orderB]) {
    expect((await fasonA1.get(`/api/portal/fason/orders/${id}`)).status(), id).toBe(404);
    expect((await fasonA1.put(`/api/portal/fason/orders/${id}/status`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(404);
    expect((await fasonA1.post(`/api/portal/fason/orders/${id}/scrap`, { data: { materialId: matA, quantity: 1 } })).status()).toBe(404);
    expect((await fasonA1.post(`/api/portal/fason/orders/${id}/ship`)).status()).toBe(404);
  }
  const stock = await (await fasonA1.get('/api/portal/fason/stock')).json();
  expect(stock.map((s: any) => s.quantity)).toEqual([10]);
  const ek = await (await fasonA1.get('/api/portal/fason/ekstre')).json();
  expect(ek.stocks.map((s: any) => s.quantity)).toEqual([10]);
  // Başka firmanın hammaddesiyle fire bildirilemez
  expect((await fasonA1.post(`/api/portal/fason/orders/${orderA1}/scrap`, { data: { materialId: matB, quantity: 1 } })).status()).toBe(404);
  expect((await prisma.subcontractorOrder.findUniqueOrThrow({ where: { id: orderA2 } })).status).toBe('MATERIAL_SENT');
});

test('fasoncu portalı firma API\'lerine ve müşteri portalına; müşteri portalı fason API\'lerine erişemez', async () => {
  for (const url of ['/api/products', '/api/customers', '/api/subcontractor-orders', `/api/subcontractors/${subA1}`, '/api/materials', '/api/company', '/api/portal/me/orders', '/api/portal/me/catalog']) {
    const s = (await fasonA1.get(url)).status();
    expect([401, 403, 404], `fasoncu → ${url} = ${s}`).toContain(s);
  }
  for (const url of ['/api/portal/fason/orders', '/api/portal/fason/stock', '/api/portal/fason/ekstre', `/api/portal/fason/orders/${orderA1}`]) {
    const s = (await customerPortalA.get(url)).status();
    expect([401, 403, 404], `müşteri portalı → ${url} = ${s}`).toContain(s);
  }
  const anon = await newClient();
  expect((await anon.get('/api/portal/fason/orders')).status()).toBe(401);
  await anon.dispose();
});

test('fasoncu portalı yanıtı firmanın fiyat/maliyet bilgisini içermez', async () => {
  const r = await fasonA1.get(`/api/portal/fason/orders/${orderA1}`);
  expect(r.status()).toBe(200);
  const body = JSON.stringify(await r.json());
  for (const secret of ['9.99', '3.33', '7.77', 'GİZLİ NOT', 'unitPrice', 'laborCostPerPair', 'pricePerKg']) {
    expect(body, `yanıtta "${secret}" olmamalı`).not.toContain(secret);
  }
});

test('fasoncu portalı girdi doğrulama: üretilen adet ve fire sınırları', async () => {
  const neg = await fasonA1.put(`/api/portal/fason/orders/${orderA1}/status`, { data: { status: 'IN_PRODUCTION', completedPairs: -50 } });
  expect(neg.status(), 'negatif üretilen adet reddedilmeli').toBe(400);
  const over = await fasonA1.post(`/api/portal/fason/orders/${orderA1}/scrap`, { data: { materialId: matA, quantity: 9999 } });
  expect(over.status(), 'zimmetten fazla fire reddedilmeli').toBe(400);
  const s = await prisma.subcontractorStock.findFirstOrThrow({ where: { subcontractorId: subA1, materialId: matA } });
  expect(s.quantity, 'zimmet eksiye düşmemeli').toBeGreaterThanOrEqual(0);
});

test('pasif fasoncunun portal hesabı giriş yapamaz', async () => {
  await prisma.subcontractor.update({ where: { id: subA2 }, data: { isActive: false } });
  const api = await newClient();
  const { login } = await import('./helpers');
  const { session } = await login(api, `sec-fason-a2-${RUN}@test.local`, PASSWORD, 'portal-credentials');
  expect(session?.user ?? null, 'pasif fasoncu girememeli').toBeNull();
  await api.dispose();
});

test('firma: teslim alma iki kez stok eklemez; zimmetten tüketim düşer', async () => {
  const before = (await prisma.product.findUniqueOrThrow({ where: { id: prodA } })).stock;
  expect((await A.owner.post(`/api/subcontractor-orders/${orderA1}/receive-products`, { data: { receivedPairs: 100 } })).status()).toBe(200);
  const second = await A.owner.post(`/api/subcontractor-orders/${orderA1}/receive-products`, { data: { receivedPairs: 100 } });
  const after = (await prisma.product.findUniqueOrThrow({ where: { id: prodA } })).stock;
  expect(second.status()).toBe(400);
  expect(after - before, 'ikinci teslim alma stoğu tekrar artırmamalı').toBe(100);
  // Reçete: 200 g × %5 fire × 100 çift = 21 kg; zimmet 10 kg → 0'a iner (eksiye düşmez)
  const z = await prisma.subcontractorStock.findFirstOrThrow({ where: { subcontractorId: subA1, materialId: matA } });
  expect(z.quantity).toBe(0);
});

test('firma: VIEWER fason işlemi yapamaz; fason izni olmayan EDITOR fason API\'lerini göremez', async () => {
  const viewer = await loggedIn(await createUser(A.companyId, `fason-viewer`, 'VIEWER'));
  expect((await viewer.post(`/api/subcontractor-orders/${orderA2}/material-transfer`, { data: { materialId: matA, quantity: 1 } })).status()).toBe(403);
  const editor = await loggedIn(await createUser(A.companyId, `fason-editor`, 'EDITOR', ['products']));
  const s = (await editor.get('/api/subcontractor-orders')).status();
  expect([401, 403], `fason izni olmayan EDITOR → /api/subcontractor-orders = ${s}`).toContain(s);
  await viewer.dispose(); await editor.dispose();
});

test('firma: durum kuralları, numara dağılımı, kapalı siparişe hammadde ve depo uyarısı', async () => {
  const bad = await A.owner.put(`/api/subcontractor-orders/${orderA2}`, { data: { status: 'FOO' } });
  expect(bad.status()).toBe(400);
  const direct = await A.owner.put(`/api/subcontractor-orders/${orderA2}`, { data: { status: 'RECEIVED' } });
  expect(direct.status(), 'Teslim Alındı yalnızca teslim alma işlemiyle').toBe(400);
  const neg = await A.owner.post('/api/subcontractor-orders', { data: { subcontractorId: subA2, productId: prodA, sizeDistribution: { '40': -5 } } });
  expect(neg.status()).toBe(400);
  const ok = await A.owner.post('/api/subcontractor-orders', { data: { subcontractorId: subA2, productId: prodA, sizeDistribution: { '40': '12', '41': 0 } } });
  expect(ok.status()).toBe(201);
  expect((await ok.json()).totalPairs).toBe(12);
  // Depodan fazla gönderim: yapılır, uyarı döner
  const over = await A.owner.post(`/api/subcontractor-orders/${orderA2}/material-transfer`, { data: { materialId: matA, quantity: 600 } });
  expect(over.status()).toBe(200);
  expect((await over.json()).warning).toMatch(/eksiye/);
  // Teslim alınmış siparişe hammadde gönderilemez
  const closed = await A.owner.post(`/api/subcontractor-orders/${orderA1}/material-transfer`, { data: { materialId: matA, quantity: 1 } });
  expect(closed.status()).toBe(400);
});

test('fasoncu: sevk bir kez; üretim ilerlemesi aynı durumda bildirilebilir; teslim alınana fire girilemez', async () => {
  const o = await prisma.subcontractorOrder.create({
    data: { companyId: A.companyId, subcontractorId: subA1, productId: prodA, orderNo: `FA3-${RUN}`, sizeDistribution: { '40': 50 }, totalPairs: 50, status: 'IN_PRODUCTION' },
  });
  const prog = await fasonA1.put(`/api/portal/fason/orders/${o.id}/status`, { data: { status: 'IN_PRODUCTION', completedPairs: 20 } });
  expect(prog.status(), await prog.text()).toBe(200);
  expect((await fasonA1.put(`/api/portal/fason/orders/${o.id}/status`, { data: { status: 'COMPLETED', completedPairs: 51 } })).status()).toBe(400);
  expect((await fasonA1.put(`/api/portal/fason/orders/${o.id}/status`, { data: { status: 'COMPLETED', completedPairs: 50 } })).status()).toBe(200);
  expect((await fasonA1.post(`/api/portal/fason/orders/${o.id}/ship`)).status()).toBe(200);
  expect((await fasonA1.post(`/api/portal/fason/orders/${o.id}/ship`)).status()).toBe(400);
  const list = await (await A.owner.get('/api/subcontractor-orders')).json();
  const row = list.find((x: any) => x.id === o.id);
  expect(row).toMatchObject({ completedPairs: 50, shipped: true });
  expect((await fasonA1.post(`/api/portal/fason/orders/${orderA1}/scrap`, { data: { materialId: matA, quantity: 0.1 } })).status()).toBe(400);
});
