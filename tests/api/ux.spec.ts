import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Kullanıcı deneyimi: Türkçe arama, mükerrer kayıt uyarısı, eksi stok, yetkisiz sayfalar.

let A: { companyId: string; owner: APIRequestContext };

test.beforeAll(async () => {
  A = await createCompany('ux');
});

test.afterAll(async () => { await cleanup(); });

test('müşteri, fatura ve hammadde araması Türkçe karakterden bağımsız', async () => {
  const name = `IŞIK Ayakkabı ${RUN}`;
  const c = await (await A.owner.post('/api/customers', { data: { name, currency: 'TRY' } })).json();
  await A.owner.post('/api/invoices', { data: { customerId: c.id, items: [{ description: 'Taban', quantity: 1, unitPrice: 1 }] } });
  await A.owner.post('/api/materials', { data: { name: `Şeffaf Kauçuk ${RUN}`, pricePerKg: 1, currency: 'TRY' } });

  for (const q of ['isik', 'ışık', 'Işık', 'IŞIK']) {
    const list = await (await A.owner.get(`/api/customers?search=${encodeURIComponent(q)}`)).json();
    expect(list.customers.map((x: any) => x.id), `müşteri: ${q}`).toContain(c.id);
    const inv = await (await A.owner.get(`/api/invoices?page=1&q=${encodeURIComponent(q)}`)).json();
    expect(inv.items.map((x: any) => x.customerId), `fatura: ${q}`).toContain(c.id);
  }
  const mats = await (await A.owner.get(`/api/materials?search=${encodeURIComponent('seffaf')}`)).json();
  expect(mats.map((m: any) => m.name)).toContain(`Şeffaf Kauçuk ${RUN}`);
});

test('aynı adlı müşteri önce onay ister, onaylanınca açılır', async () => {
  const name = `Çift Kayıt Ltd ${RUN}`;
  expect((await A.owner.post('/api/customers', { data: { name, currency: 'TRY' } })).status()).toBe(200);
  const dup = await A.owner.post('/api/customers', { data: { name: name.toLocaleUpperCase('tr'), currency: 'TRY' } });
  expect(dup.status()).toBe(409);
  const body = await dup.json();
  expect(body.code).toBe('DUPLICATE_NAME');
  expect(body.existing.name).toBe(name);
  const forced = await A.owner.post('/api/customers', { data: { name: name.toLocaleUpperCase('tr'), currency: 'TRY', allowDuplicate: true } });
  expect(forced.status()).toBe(200);
});

test('aynı adlı tedarikçi de onay ister', async () => {
  const name = `Kimya Depo ${RUN}`;
  await A.owner.post('/api/suppliers', { data: { name, currency: 'USD' } });
  expect((await A.owner.post('/api/suppliers', { data: { name, currency: 'USD' } })).status()).toBe(409);
});

test('ana sayfa eksi stoktaki ürünleri listeler', async () => {
  const p = await (await A.owner.post('/api/products', { data: { name: `Eksi Ürün ${RUN}`, stock: 2 } })).json();
  const c = await (await A.owner.post('/api/customers', { data: { name: `Stok Müşteri ${RUN}`, currency: 'TRY' } })).json();
  await A.owner.post('/api/invoices', { data: { customerId: c.id, items: [{ description: 'x', productId: p.id, quantity: 5, unitPrice: 1 }] } });
  const d = await (await A.owner.get('/api/dashboard')).json();
  expect(d.negativeStock.products).toEqual([expect.objectContaining({ id: p.id, stock: -3 })]);
});

test('işlem kayıtları ve yönetim sayfası firma sahibine yetkisiz ekranı gösterir', async () => {
  for (const path of ['/logs', '/admin']) {
    const r = await A.owner.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(307);
    expect(r.headers()['location'], path).toContain('/yetkisiz');
  }
  expect((await prisma.user.count({ where: { companyId: A.companyId, role: 'ADMIN' } }))).toBe(0);
});
