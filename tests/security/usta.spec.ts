import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, createUser, loggedIn, cleanup } from './helpers';

// Kısıtlı profil: "Usta" (gelen siparişleri salt okunur görür, hammadde siparişi verir) ve "Nakliyeci" (yalnız sevk fişi).
// Fiyat, cari bakiye, satış ve ödeme uçlarına giremezler; sayfalarda yalnız izinli ekranlar açılır.
let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let usta: APIRequestContext; let nakliye: APIRequestContext;
let linkId: string; let productB: string; let orderId: string; let custId: string;

test.beforeAll(async () => {
  A = await createCompany('usta-a');
  B = await createCompany('usta-tedarikci');
  usta = await loggedIn(await createUser(A.companyId, 'usta', 'EDITOR', ['orders-view', 'material-orders']));
  nakliye = await loggedIn(await createUser(A.companyId, 'nakliye-k', 'EDITOR', ['sevkiyat']));
  // A, B'den hammadde alır (firma ağı bağlantısı)
  const code = (await (await B.owner.get('/api/network/code')).json()).code;
  linkId = (await (await A.owner.post('/api/network/links', { data: { code } })).json()).link.id;
  expect((await B.owner.post(`/api/network/links/${linkId}/approve`, { data: { createCustomer: true } })).status()).toBe(200);
  productB = (await prisma.product.create({ data: { companyId: B.companyId, name: `Granül ${RUN}`, code: 'GR', unitPrice: 9, portalVisible: true, sizes: ['38'] } })).id;
  // A'nın gelen siparişi
  custId = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri ${RUN}` } })).id;
  const pA = (await prisma.product.create({ data: { companyId: A.companyId, name: `Taban ${RUN}`, code: 'TB', unitPrice: 50 } })).id;
  const o = await A.owner.post('/api/orders', { data: { customerId: custId, productId: pA, sizeDistribution: { '40': 10 }, notes: `usta ${RUN}` } });
  expect(o.status(), await o.text()).toBe(201);
  orderId = (await o.json()).id;
});
test.afterAll(async () => { await usta.dispose(); await nakliye.dispose(); await cleanup(); });

test('usta: gelen siparişleri görür ama değiştiremez', async () => {
  const list = await usta.get('/api/orders');
  expect(list.status()).toBe(200);
  expect(JSON.stringify(await list.json())).toContain(orderId);
  expect((await usta.get(`/api/orders/${orderId}`)).status()).toBe(200);
  expect((await usta.put(`/api/orders/${orderId}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(403);
  expect((await usta.post('/api/orders', { data: { customerId: custId, sizeDistribution: { '40': 1 } } })).status()).toBe(403);
  expect((await usta.post(`/api/orders/${orderId}/confirm`, { data: {} })).status()).toBe(403);
  // Fiyat yok: sipariş detayında çözülmüş fiyat dönmez
  expect((await (await usta.get(`/api/orders/${orderId}`)).json()).prices).toEqual({});
  // Müşteri filtresi için yalnız adlar
  expect((await usta.get('/api/customers?minimal=true')).status()).toBe(200);
});

test('usta: fiyat, cari, satış ve ödeme uçlarına giremez', async () => {
  for (const path of ['/api/invoices', '/api/payments', '/api/customers', `/api/customers/${custId}`, '/api/suppliers', '/api/purchases',
    '/api/accounts', '/api/dashboard', '/api/dispatches', '/api/products', '/api/materials', '/api/cek', '/api/company']) {
    expect((await usta.get(path)).status(), path).toBe(403);
  }
});

test('usta: bağlı tedarikçiye hammadde siparişi verir ve verilen siparişleri görür', async () => {
  const links = await (await usta.get('/api/network/links')).json();
  expect(links.asBuyer.map((l: any) => l.id)).toContain(linkId);
  const r = await usta.post(`/api/network/links/${linkId}/orders`, { data: { orderItems: [{ productId: productB, sizeDistribution: { '38': 5 } }] } });
  expect(r.status(), await r.text()).toBe(201);
  const mine = await (await usta.get('/api/network/orders')).json();
  expect(mine.map((o: any) => o.id)).toContain((await r.json()).id);
});

test('usta ve nakliyeci: sayfa izinleri ve açılış sayfası', async () => {
  const go = async (ctx: APIRequestContext, path: string) => {
    const r = await ctx.get(path, { maxRedirects: 0 });
    return r.status() >= 300 && r.status() < 400 ? new URL(r.headers()['location'], 'http://x').pathname : String(r.status());
  };
  expect(await go(usta, '/orders')).toBe('200');
  expect(await go(usta, `/orders/${orderId}`)).toBe('200');
  expect(await go(usta, '/verilen-siparisler')).toBe('200');
  expect(await go(usta, '/verilen-siparisler/yeni')).toBe('200');
  expect(await go(usta, '/dashboard')).toBe('/orders');
  for (const p of ['/customers', '/suppliers', '/invoices', '/purchases', '/sevkiyat', '/settings', '/accounts']) expect(await go(usta, p), p).toBe('/yetkisiz');
  expect(await go(nakliye, '/dashboard')).toBe('/sevkiyat');
  expect(await go(nakliye, '/sevkiyat')).toBe('200');
  for (const p of ['/orders', '/verilen-siparisler', '/purchases', '/customers']) expect(await go(nakliye, p), p).toBe('/yetkisiz');
});

test('nakliyeci: sevk formu için müşteri adı ve ürün listesi (fiyatsız); cari ve satış uçları kapalı', async () => {
  expect((await nakliye.get('/api/customers?minimal=true')).status()).toBe(200);
  expect((await nakliye.get('/api/customers')).status()).toBe(403);
  expect((await nakliye.get(`/api/customers/${custId}`)).status()).toBe(403);
  const products = await (await nakliye.get('/api/products?list=1')).json();
  expect(products.length).toBeGreaterThan(0);
  expect(JSON.stringify(products)).not.toContain('unitPrice');
  for (const path of ['/api/invoices', '/api/payments', '/api/purchases', '/api/accounts']) expect((await nakliye.get(path)).status(), path).toBe(403);
  expect((await nakliye.get('/api/dispatches')).status()).toBe(200);
});

test('tam yetkili ve diğer düzenleyiciler etkilenmez', async () => {
  const ed = await loggedIn(await createUser(A.companyId, 'normal-ed', 'EDITOR', ['orders', 'customers']));
  expect((await ed.put(`/api/orders/${orderId}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(200);
  expect((await ed.get('/api/customers')).status()).toBe(200);
  expect((await ed.get('/api/invoices')).status()).toBe(200);
  await ed.dispose();
});
