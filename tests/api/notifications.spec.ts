import { test, expect, APIRequestContext } from '@playwright/test';
import {
  prisma, PASSWORD, RUN, createCompany, createUser, createPortalCustomer, loggedIn, newClient, cleanup,
} from '../security/helpers';

// Bildirim kutusu: gönderilen sipariş bildirimleri alıcı başına saklanır (push token'ı olmasa da),
// herkes yalnızca kendi kutusunu görür ve okundu yapabilir, liste sayfalıdır.

let S: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let X: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;
const rnd = () => Math.random().toString(36).slice(2, 6);

test.beforeAll(async () => {
  S = await createCompany('bildirim-satici');
  X = await createCompany('bildirim-yabanci');
  anon = await newClient();
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

const inbox = async (c: APIRequestContext, q = '') => {
  const r = await c.get(`/api/notifications${q}`);
  expect(r.status(), await r.text()).toBe(200);
  return r.json() as Promise<{ items: Array<{ id: string; title: string; body: string; url: string | null; readAt: string | null }>; unreadCount: number; nextCursor: string | null }>;
};

test('portal siparişi ve onayı kutulara yazılır; başkası göremez, okundu yapamaz', async () => {
  const cust = await prisma.customer.create({ data: { companyId: S.companyId, name: `Bildirim Müşteri ${RUN}` } });
  const portalEmail = await createPortalCustomer(cust.id, `bildirim-portal-${rnd()}`);
  const product = await prisma.product.create({ data: { companyId: S.companyId, name: `Bildirim Taban ${RUN}`, unit: 'çift', portalVisible: true } as any });
  const portal = await loggedIn(portalEmail, PASSWORD, 'portal-credentials');
  const orderViewer = await loggedIn(await createUser(S.companyId, `bildirim-ed-${rnd()}`, 'VIEWER', ['orders']));
  const noOrders = await loggedIn(await createUser(S.companyId, `bildirim-x-${rnd()}`, 'EDITOR'));

  // Kimsenin push token'ı yok: bildirim yine de kutuya yazılır
  const created = await portal.post('/api/portal/me/orders', { data: { orderItems: [{ productId: product.id, color: 'Siyah', sizeDistribution: { '40': 10 } }] } });
  expect(created.status(), await created.text()).toBe(201);
  const orderId = (await created.json()).id;

  const own = await inbox(S.owner);
  expect(own.unreadCount).toBe(1);
  expect(own.items[0].title).toContain('portal');
  expect(own.items[0].url).toBe(`/siparis/gelen/${orderId}`);
  expect((await inbox(orderViewer)).unreadCount).toBe(1); // sipariş izni olan görüntüleyici
  expect((await inbox(noOrders)).items).toHaveLength(0); // sipariş izni olmayan almaz
  expect((await inbox(X.owner)).items).toHaveLength(0);
  expect((await inbox(portal)).items).toHaveLength(0);

  // Başka firma ve portal hesabı satıcının bildirimini okundu yapamaz
  const nid = own.items[0].id;
  expect((await (await X.owner.post('/api/notifications/read', { data: { ids: [nid] } })).json()).updated).toBe(0);
  expect((await (await portal.post('/api/notifications/read', { data: { ids: [nid] } })).json()).updated).toBe(0);
  expect((await inbox(S.owner)).unreadCount).toBe(1);
  // Başkasının kaydı imleç olarak verilirse hiçbir şey dönmez
  expect((await inbox(X.owner, `?before=${nid}`)).items).toHaveLength(0);

  // Onay → portal müşterisinin kutusu (web adresi portal sipariş sayfası)
  expect((await S.owner.post(`/api/orders/${orderId}/confirm`, { data: { confirmedDeliveryDate: '2026-12-15' } })).status()).toBe(200);
  const p = await inbox(portal);
  expect(p.unreadCount).toBe(1);
  expect(p.items[0].body).toContain('onaylandı');
  expect(p.items[0].url).toBe(`/siparisler/${orderId}`);
  expect((await inbox(S.owner)).items).toHaveLength(1); // satıcıya onay bildirimi gitmez

  // Görüntüleyici kendi bildirimini okundu yapabilir
  const read = await orderViewer.post('/api/notifications/read', { data: { all: true } });
  expect(read.status(), await read.text()).toBe(200);
  expect((await read.json()).unreadCount).toBe(0);
  expect((await inbox(S.owner)).unreadCount).toBe(1); // diğer kullanıcınınki etkilenmez

  const one = await (await S.owner.post('/api/notifications/read', { data: { ids: [nid] } })).json();
  expect(one).toMatchObject({ updated: 1, unreadCount: 0 });
  expect((await inbox(S.owner)).items[0].readAt).toBeTruthy();
  expect((await S.owner.post('/api/notifications/read', { data: {} })).status()).toBe(400);

  // Portal hesabı başka bir firma sayfasına (personel bildirimleri) erişemez ama kendi kutusunu okur
  expect((await portal.post('/api/notifications/read', { data: { all: true } })).status()).toBe(200);
  expect((await inbox(portal)).unreadCount).toBe(0);
});

test('liste yeniden eskiye ve sayfalı; oturumsuz istek reddedilir', async () => {
  const other = await createUser(S.companyId, `bildirim-sayfa-${rnd()}`, 'EDITOR');
  const otherId = (await prisma.user.findFirstOrThrow({ where: { email: other }, select: { id: true } })).id;
  const base = Date.now() - 3_600_000;
  await prisma.notification.createMany({
    data: Array.from({ length: 25 }, (_, i) => ({ userId: otherId, companyId: S.companyId, title: `Sayfa ${i}`, body: 'b', createdAt: new Date(base + i * 1000) })),
  });
  // Kullanıcı başka firmaya geçmiş gibi: eski firmadaki kayıt yeni firmada görünmez
  await prisma.notification.create({ data: { userId: otherId, companyId: X.companyId, title: 'Eski firma', body: 'b' } });

  const c = await loggedIn(other);
  const first = await inbox(c, '?limit=10');
  expect(first.items.map(i => i.title)).toEqual(Array.from({ length: 10 }, (_, i) => `Sayfa ${24 - i}`));
  expect(first.unreadCount).toBe(25);
  const second = await inbox(c, `?limit=10&before=${first.nextCursor}`);
  expect(second.items[0].title).toBe('Sayfa 14');
  const third = await inbox(c, `?limit=10&before=${second.nextCursor}`);
  expect(third.items.map(i => i.title)).toEqual(['Sayfa 4', 'Sayfa 3', 'Sayfa 2', 'Sayfa 1', 'Sayfa 0']);
  expect(third.nextCursor).toBeNull();

  expect((await anon.get('/api/notifications')).status()).toBe(401);
  expect((await anon.post('/api/notifications/read', { data: { all: true } })).status()).toBe(401);
});
