import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Firma ağı siparişinde mesajlaşma: alıcı (A) "Verilen Siparişler"den, satıcı (B) sipariş detayından yazar;
// karşı tarafa bildirim düşer. Bağlantısız firma (C) ve portal oturumu erişemez. Karşı tarafı olmayan siparişte
// mesaj kutusu kapalıdır.
let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let C: { companyId: string; owner: APIRequestContext };
let orderId: string;

test.beforeAll(async () => {
  A = await createCompany('agm-alici');
  B = await createCompany('agm-satici');
  C = await createCompany('agm-yabanci');
  const code = (await (await B.owner.get('/api/network/code')).json()).code;
  const link = (await (await A.owner.post('/api/network/links', { data: { code } })).json()).link;
  expect((await B.owner.post(`/api/network/links/${link.id}/approve`, { data: { createCustomer: true } })).status()).toBe(200);
  const p = await prisma.product.create({ data: { companyId: B.companyId, name: `AGM ${RUN}`, code: 'AGM', unitPrice: 5, portalVisible: true, sizes: ['38', '39'] } });
  const r = await A.owner.post(`/api/network/links/${link.id}/orders`, { data: { orderItems: [{ productId: p.id, sizeDistribution: { '38': 4 } }] } });
  expect(r.status(), await r.text()).toBe(201);
  orderId = (await r.json()).id;
});
test.afterAll(async () => { await cleanup(); });

const notes = (companyId: string) => prisma.notification.findMany({ where: { companyId, userId: { not: null } }, orderBy: { createdAt: 'desc' } });

test('alıcı yazar → satıcıya bildirim ve okunmamış; satıcı yanıtlar → alıcıya bildirim', async () => {
  const detail = await (await B.owner.get(`/api/orders/${orderId}`)).json();
  expect([detail.messaging, detail.counterparty]).toEqual([true, 'network']);

  const m = await A.owner.post(`/api/network/orders/${orderId}/messages`, { data: { body: 'Termin öne alınabilir mi?' } });
  expect(m.status(), await m.text()).toBe(201);
  expect((await m.json()).authorName).toContain('agm-alici');
  const sellerList = (await (await B.owner.get('/api/orders?from=2000-01-01')).json()).find((o: any) => o.id === orderId);
  expect(sellerList.unreadMessages).toBe(1);
  const bn = await notes(B.companyId);
  expect(bn[0].body).toContain('Termin öne alınabilir mi?');
  expect(bn[0].url).toBe(`/siparis/gelen/${orderId}`);
  expect((await notes(A.companyId)).some(n => n.body.includes('Termin öne'))).toBe(false);

  expect((await B.owner.get(`/api/orders/${orderId}/messages`)).status()).toBe(200);
  expect((await B.owner.post(`/api/orders/${orderId}/messages`, { data: { body: 'Evet, 2 gün öne alırız' } })).status()).toBe(201);
  const an = await notes(A.companyId);
  expect(an[0].body).toContain('Evet, 2 gün öne alırız');
  expect(an[0].url).toBe(`/siparis/verilen/${orderId}`);
  expect((await notes(B.companyId)).some(n => n.body.includes('Evet, 2 gün'))).toBe(false);

  const buyerList = (await (await A.owner.get('/api/network/orders')).json()).find((o: any) => o.id === orderId);
  expect(buyerList.unreadMessages).toBe(1);
  const thread = await (await A.owner.get(`/api/network/orders/${orderId}/messages`)).json();
  expect(thread.map((x: any) => x.body)).toEqual(['Termin öne alınabilir mi?', 'Evet, 2 gün öne alırız']);
  const after = (await (await A.owner.get('/api/network/orders')).json()).find((o: any) => o.id === orderId);
  expect(after.unreadMessages).toBe(0);
});

test('bağlantısız firma ve satıcı, alıcı ucunu kullanamaz; alıcı satıcı ucunu kullanamaz', async () => {
  expect((await C.owner.get(`/api/network/orders/${orderId}/messages`)).status()).toBe(404);
  expect((await C.owner.post(`/api/network/orders/${orderId}/messages`, { data: { body: 'x' } })).status()).toBe(404);
  expect((await B.owner.post(`/api/network/orders/${orderId}/messages`, { data: { body: 'x' } })).status()).toBe(404);
  expect((await A.owner.post(`/api/orders/${orderId}/messages`, { data: { body: 'x' } })).status()).toBe(404);
  expect((await C.owner.get(`/api/orders/${orderId}/messages`)).status()).toBe(404);
  expect(JSON.stringify(await (await C.owner.get('/api/network/orders')).json())).not.toContain(orderId);
});

test('karşı tarafı olmayan siparişte mesaj kutusu kapalı, firma mesajı reddedilir', async () => {
  const cust = await prisma.customer.create({ data: { companyId: B.companyId, name: `Portalsız ${RUN}` } });
  const r = await B.owner.post('/api/orders', { data: { customerId: cust.id, sizeDistribution: { '40': 3 } } });
  expect(r.status(), await r.text()).toBe(201);
  const id = (await r.json()).id;
  const d = await (await B.owner.get(`/api/orders/${id}`)).json();
  expect([d.messaging, d.counterparty]).toEqual([false, null]);
  expect((await B.owner.post(`/api/orders/${id}/messages`, { data: { body: 'kimse okumaz' } })).status()).toBe(400);
});
