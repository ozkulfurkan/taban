import { test, expect, APIRequestContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import {
  prisma, PASSWORD, RUN, createCompany, createUser, createPortalCustomer, loggedIn, newClient, cleanup,
} from '../security/helpers';

// Sipariş onayı ve bildirimler: satıcı yeni gelen siparişi onaylar, sipariş verene (portal müşterisi
// ya da bağlı firma) anlık bildirim + e-posta gider; satıcı firmanın kendi kullanıcılarına gitmez.
// Bildirimler NOTIFY_OUTBOX dosyasından okunur (sunucu bu değişkenle başlatılmalı).

const OUTBOX = process.env.NOTIFY_OUTBOX;
test.skip(!OUTBOX, 'NOTIFY_OUTBOX tanımlı değil (sunucu ve testler aynı dosyayı kullanmalı)');

type Entry = { kind: 'push' | 'mail'; tokens?: string[]; title?: string; body?: string; to?: string | string[]; subject?: string };
const since = () => (OUTBOX && existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean).length : 0);
const entriesAfter = (n: number): Entry[] => (OUTBOX && existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean).slice(n).map(l => JSON.parse(l)) : []);
const pushesTo = (es: Entry[], token: string) => es.filter(e => e.kind === 'push' && e.tokens?.includes(token));
const wait = () => new Promise(r => setTimeout(r, 300));

let S: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let B: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;
const tok = (name: string) => `ExponentPushToken[${name}${RUN}]`;

async function registerToken(email: string, token: string, kind: 'staff' | 'portal' = 'staff') {
  const login = await anon.post('/api/mobile/auth/login', { data: { email, password: PASSWORD, kind } });
  expect(login.status(), await login.text()).toBe(200);
  const r = await anon.post('/api/mobile/push-token', { headers: { Authorization: `Bearer ${(await login.json()).token}` }, data: { token, platform: 'ios' } });
  expect(r.status()).toBe(200);
}

test.beforeAll(async () => {
  S = await createCompany('onay-satici');
  B = await createCompany('onay-alici');
  anon = await newClient();
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

test('portal siparişi: onay butonu, alıcıya bildirim, satıcıya gitmez; tekrar onay ve görüntüleyici reddedilir', async () => {
  const cust = await prisma.customer.create({ data: { companyId: S.companyId, name: `Onay Müşteri ${RUN}` } });
  const portalEmail = await createPortalCustomer(cust.id, `onay-portal-${Math.random().toString(36).slice(2, 6)}`);
  const product = await prisma.product.create({ data: { companyId: S.companyId, name: `Onay Taban ${RUN}`, unit: 'çift', portalVisible: true } as any });
  await registerToken(portalEmail, tok('portal'), 'portal');
  await registerToken(S.ownerEmail, tok('seller'));

  const portal = await loggedIn(portalEmail, PASSWORD, 'portal-credentials');
  const created = await portal.post('/api/portal/me/orders', { data: { orderItems: [{ productId: product.id, color: 'Siyah', sizeDistribution: { '40': 10 } }] } });
  expect(created.status(), await created.text()).toBe(201);
  const orderId = (await created.json()).id;

  // Alıcı "Onay bekliyor" görür
  const before = await (await portal.get(`/api/portal/me/orders/${orderId}`)).json();
  expect(before.status).toBe('ORDER_RECEIVED');
  expect(before.confirmedAt).toBeNull();

  const viewer = await loggedIn(await createUser(S.companyId, `onay-v-${Math.random().toString(36).slice(2, 6)}`, 'VIEWER'));
  expect((await viewer.post(`/api/orders/${orderId}/confirm`, { data: {} })).status()).toBe(403);
  expect((await B.owner.post(`/api/orders/${orderId}/confirm`, { data: {} })).status()).toBe(404);

  const n = since();
  const ok = await S.owner.post(`/api/orders/${orderId}/confirm`, { data: { confirmedDeliveryDate: '2026-12-15', note: 'Hafta içi hazır' } });
  expect(ok.status(), await ok.text()).toBe(200);
  await wait();
  const es = entriesAfter(n);
  const toBuyer = pushesTo(es, tok('portal'));
  expect(toBuyer.length).toBe(1);
  expect(toBuyer[0].body).toContain('onaylandı');
  expect(toBuyer[0].body).toContain('15.12.2026');
  expect(pushesTo(es, tok('seller'))).toHaveLength(0);
  expect(es.some(e => e.kind === 'mail' && e.to === portalEmail && /onaylandı/.test(e.subject ?? ''))).toBeTruthy();

  const after = await (await portal.get(`/api/portal/me/orders/${orderId}`)).json();
  expect(after.confirmedAt).toBeTruthy();
  expect(new Date(after.confirmedDeliveryDate).toISOString().slice(0, 10)).toBe('2026-12-15');
  expect((await S.owner.post(`/api/orders/${orderId}/confirm`, { data: {} })).status()).toBe(409);

  // Durum değişikliği: alıcıya gider, satıcıya gitmez
  const m = since();
  expect((await S.owner.put(`/api/orders/${orderId}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(200);
  await wait();
  const es2 = entriesAfter(m);
  expect(pushesTo(es2, tok('portal')).length).toBe(1);
  expect(pushesTo(es2, tok('seller'))).toHaveLength(0);

  // Yalnızca termin değişince de alıcıya bildirilir
  const k = since();
  expect((await S.owner.put(`/api/orders/${orderId}`, { data: { confirmedDeliveryDate: '2026-12-20' } })).status()).toBe(200);
  await wait();
  const es3 = entriesAfter(k);
  expect(pushesTo(es3, tok('portal')).some(e => /Termin/.test(e.body ?? ''))).toBeTruthy();
  expect(pushesTo(es3, tok('seller'))).toHaveLength(0);
  await Promise.all([portal.dispose(), viewer.dispose()]);
});

test('onaylanmadan ilerletilen sipariş onaylanmış sayılır', async () => {
  const cust = await prisma.customer.create({ data: { companyId: S.companyId, name: `Oto Onay ${RUN}` } });
  const o = await prisma.soleOrder.create({ data: { companyId: S.companyId, customerId: cust.id, orderNo: `ON-${RUN}`, sizeDistribution: { '40': 5 }, totalQuantity: 5 } });
  expect((await S.owner.put(`/api/orders/${o.id}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(200);
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id: o.id } })).confirmedAt).toBeTruthy();
  expect((await S.owner.post(`/api/orders/${o.id}/confirm`, { data: {} })).status()).toBe(409);
});

test('firma ağı siparişi: onay ve durum bildirimi alıcı firmaya gider, satıcı firmaya gitmez', async () => {
  const cust = await prisma.customer.create({ data: { companyId: S.companyId, name: `Ağ Alıcı ${RUN}` } });
  const sup = await prisma.supplier.create({ data: { companyId: B.companyId, name: `Ağ Satıcı ${RUN}` } });
  const link = await prisma.companyLink.create({ data: { buyerCompanyId: B.companyId, sellerCompanyId: S.companyId, buyerSupplierId: sup.id, sellerCustomerId: cust.id, status: 'ACTIVE' } });
  const buyerUser = await prisma.user.findUniqueOrThrow({ where: { email: B.ownerEmail } });
  const o = await prisma.soleOrder.create({ data: { companyId: S.companyId, customerId: cust.id, linkId: link.id, buyerUserId: buyerUser.id, orderNo: `AG-${RUN}`, sizeDistribution: { '40': 5 }, totalQuantity: 5 } });
  await registerToken(B.ownerEmail, tok('buyerfirm'));
  await registerToken(S.ownerEmail, tok('seller2'));

  const n = since();
  expect((await S.owner.post(`/api/orders/${o.id}/confirm`, { data: {} })).status()).toBe(200);
  await wait();
  const es = entriesAfter(n);
  expect(pushesTo(es, tok('buyerfirm')).length).toBe(1);
  expect(pushesTo(es, tok('seller2'))).toHaveLength(0);
  expect(es.some(e => e.kind === 'mail' && e.to === B.ownerEmail)).toBeTruthy();

  // Bağlantı kaldırılınca bildirim gitmez
  await prisma.companyLink.update({ where: { id: link.id }, data: { status: 'REVOKED' } });
  const m = since();
  expect((await S.owner.put(`/api/orders/${o.id}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(200);
  await wait();
  expect(pushesTo(entriesAfter(m), tok('buyerfirm'))).toHaveLength(0);
});
