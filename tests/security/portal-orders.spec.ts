import { test, expect, APIRequestContext } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { prisma, PASSWORD, RUN, createCompany, createUser, loggedIn, login, newClient, cleanup } from './helpers';

// Müşteri portalından gelen sipariş süreci: müşteriler ve firmalar arası ayrım, katalog görünürlüğü,
// yanıt alanları, sipariş doğrulama ve firma tarafı işlem kuralları.
// docs/PORTAL-DENETIM.md bulguları (kod parantezde) ve sonraki geliştirmeler (mesaj, talep, fiyat, kısmi sevk).

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
test('sipariş girdi doğrulama: negatif/ondalık/metin adet, geçersiz termin', async () => {
  const cases: [string, any][] = [
    ['negatif adet', { productId: pubA, sizeDistribution: { '39': -5, '40': 10 } }],
    ['ondalık adet', { productId: pubA, sizeDistribution: { '40': 2.5 } }],
    ['metin adet', { productId: pubA, sizeDistribution: { '40': 'on' } }],
    ['geçersiz termin', { productId: pubA, sizeDistribution: { '40': 1 }, requestedDeliveryDate: 'yarın' }],
    ['geçmiş termin', { productId: pubA, sizeDistribution: { '40': 1 }, requestedDeliveryDate: '2020-01-01' }],
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
test('firma: durum geçişleri; iptal edilen ilerletilemez, sevk edilen geri alınamaz', async () => {
  const r = await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '40': 3 } } });
  const id = (await r.json()).id;
  expect((await A.owner.put(`/api/orders/${id}`, { data: { status: 'CANCELLED' } })).status()).toBe(200);
  const revive = await A.owner.put(`/api/orders/${id}`, { data: { status: 'IN_PRODUCTION' } });
  expect(revive.status(), 'iptal edilen sipariş üretime alınmamalı').toBe(400);
  // İptal yalnızca "geri al" ile Sipariş Alındı'ya döner
  expect((await A.owner.put(`/api/orders/${id}`, { data: { status: 'ORDER_RECEIVED' } })).status()).toBe(200);
  // İptal edilmiş siparişe sevkiyat girilemez
  const id2 = (await (await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '38': 3 } } })).json()).id;
  await A.owner.put(`/api/orders/${id2}`, { data: { status: 'CANCELLED' } });
  expect((await A.owner.put(`/api/orders/${id2}`, { data: { shipment: { shipmentDate: '2026-11-25' } } })).status()).toBe(400);
});

// P-G1
test('firma: "sipariş" izni olmayan EDITOR siparişleri okuyamaz; VIEWER değiştiremez', async () => {
  const editor = await loggedIn(await createUser(A.companyId, 'po-editor', 'EDITOR', ['products']));
  const s = (await editor.get('/api/orders')).status();
  expect([401, 403], `sipariş izni olmayan EDITOR → /api/orders = ${s}`).toContain(s);
  const viewer = await loggedIn(await createUser(A.companyId, 'po-viewer', 'VIEWER'));
  expect((await viewer.put(`/api/orders/${orderM2}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(403);
  await editor.dispose(); await viewer.dispose();
});

// Ö1, Ö2: mesajlar ve talepler
test('mesajlar: müşteri yalnızca kendi siparişine yazar/okur; firma ayrımı', async () => {
  expect((await M1.post(`/api/portal/me/orders/${orderM2}/messages`, { data: { body: 'merhaba' } })).status()).toBe(404);
  expect((await M1.get(`/api/portal/me/orders/${orderM2}/messages`)).status()).toBe(404);
  expect((await M1.get(`/api/portal/me/orders/${orderMB}/messages`)).status()).toBe(404);
  expect((await A.owner.get(`/api/orders/${orderMB}/messages`)).status()).toBe(404);
  expect((await A.owner.post(`/api/orders/${orderMB}/messages`, { data: { body: 'x' } })).status()).toBe(404);

  const m = await M2.post(`/api/portal/me/orders/${orderM2}/messages`, { data: { body: 'Renk koyu olsun' } });
  expect(m.status()).toBe(201);
  // Firma okunmamış olarak görür, açınca okundu olur
  const unread = (await (await A.owner.get('/api/orders?from=2000-01-01')).json()).find((o: any) => o.id === orderM2);
  expect(unread.unreadMessages).toBe(1);
  const staffView = await (await A.owner.get(`/api/orders/${orderM2}/messages`)).json();
  expect(staffView.map((x: any) => x.body)).toContain('Renk koyu olsun');
  expect((await A.owner.post(`/api/orders/${orderM2}/messages`, { data: { body: 'Tamam' } })).status()).toBe(201);
  const after = (await (await A.owner.get('/api/orders?from=2000-01-01')).json()).find((o: any) => o.id === orderM2);
  expect(after.unreadMessages).toBe(0);
  expect((await (await M2.get(`/api/portal/me/orders/${orderM2}`)).json()).unreadMessages).toBe(1);
  // Başka müşteri ve başka firma bu mesajları görmez
  expect(JSON.stringify(await (await MB.get('/api/portal/me/orders')).json())).not.toContain('Renk koyu');
  expect(JSON.stringify(await (await B.owner.get('/api/orders?from=2000-01-01')).json())).not.toContain(orderM2);
});

test('iptal: onaydan önce müşteri iptal eder; onaydan sonra talep açılır, firma onaylarsa iptal olur', async () => {
  const id = (await (await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '38': 7 } } })).json()).id;
  expect((await M2.post(`/api/portal/me/orders/${id}/cancel`)).status()).toBe(404);
  expect((await M1.post(`/api/portal/me/orders/${id}/cancel`)).status()).toBe(200);
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');

  const id2 = (await (await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '38': 8 } } })).json()).id;
  expect((await A.owner.post(`/api/orders/${id2}/confirm`, { data: {} })).status()).toBe(200);
  expect((await M1.post(`/api/portal/me/orders/${id2}/cancel`)).status()).toBe(409);
  const req = await M1.post(`/api/portal/me/orders/${id2}/messages`, { data: { kind: 'CANCEL_REQUEST', body: 'Vazgeçtik' } });
  expect(req.status()).toBe(201);
  // Aynı anda ikinci talep açılmaz
  expect((await M1.post(`/api/portal/me/orders/${id2}/messages`, { data: { kind: 'CHANGE_REQUEST', body: 'x' } })).status()).toBe(400);
  const list = (await (await A.owner.get('/api/orders?from=2000-01-01')).json()).find((o: any) => o.id === id2);
  expect(list.openRequest).toBe('CANCEL_REQUEST');
  const mid = (await req.json()).id;
  // Başka firma yanıtlayamaz
  expect((await B.owner.post(`/api/orders/${id2}/messages/${mid}/resolve`, { data: { resolution: 'approved' } })).status()).toBe(404);
  expect((await A.owner.post(`/api/orders/${id2}/messages/${mid}/resolve`, { data: { resolution: 'approved' } })).status()).toBe(200);
  expect((await A.owner.post(`/api/orders/${id2}/messages/${mid}/resolve`, { data: { resolution: 'rejected' } })).status()).toBe(409);
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id: id2 } })).status).toBe('CANCELLED');
});

// Ö3: fiyat gösterimi
test('fiyat: ayar kapalıyken dönmez; açıkken müşteriye özel fiyat, başkasınınki görünmez', async () => {
  const off = JSON.stringify(await (await M1.get('/api/portal/me/catalog')).json());
  expect(off).not.toContain('9.99');
  await prisma.customerProductPrice.create({ data: { companyId: A.companyId, customerId: custA2, productId: pubA, unitPrice: 5.55, currency: 'TRY' } });
  // Firma ayarı yalnızca firma sahibi/yöneticiyle değişir; müşteri değiştiremez
  expect((await M1.put('/api/company', { data: { portalShowPrices: true } })).status()).not.toBe(200);
  expect((await A.owner.put('/api/company', { data: { portalShowPrices: true } })).status()).toBe(200);
  try {
    const c1 = (await (await M1.get('/api/portal/me/catalog')).json()).find((p: any) => p.id === pubA);
    expect(c1.price).toEqual({ unitPrice: 9.99, currency: 'USD', special: false });
    const c2 = (await (await M2.get('/api/portal/me/catalog')).json()).find((p: any) => p.id === pubA);
    expect(c2.price).toEqual({ unitPrice: 5.55, currency: 'TRY', special: true });
    expect(JSON.stringify(await (await M1.get('/api/portal/me/catalog')).json())).not.toContain('5.55');
    const d2 = await (await M2.get(`/api/portal/me/orders/${orderM2}`)).json();
    expect(d2.prices[pubA].unitPrice).toBe(5.55);
    // Maliyet ve reçete yine dönmez
    for (const s of ['3.33', '7.77', '222', 'laborCostPerPair']) expect(JSON.stringify(c1)).not.toContain(s);
    // Başka firmanın müşterisi etkilenmez
    expect(JSON.stringify(await (await MB.get('/api/portal/me/catalog')).json())).not.toContain('"price"');
  } finally {
    await prisma.company.update({ where: { id: A.companyId }, data: { portalShowPrices: false } });
  }
});

// Ö4, Ö5: kısmi sevkiyat ve irsaliye
test('kısmi sevkiyat: durum değişmez, kalan izlenir; son sevkte Sevk Edildi; irsaliye yalnızca sahibine', async () => {
  const id = (await (await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '39': 10, '40': 10 } } })).json()).id;
  const p1 = await A.owner.put(`/api/orders/${id}`, { data: { shipment: { mode: 'new', final: false, shipmentDate: '2026-11-25', deliveryNoteNo: 'K-1', items: [{ index: 0, shipped: 12 }] } } });
  expect(p1.status(), await p1.text()).toBe(200);
  let o = await (await A.owner.get(`/api/orders/${id}`)).json();
  expect(o.status).toBe('ORDER_RECEIVED');
  expect(o.shipments).toHaveLength(1);
  expect(o.shipment.deliveryNoteNo).toBe('K-1');
  // Fazla sevk (kalan 8 × 1,5 = 12'yi aşan) reddedilir
  expect((await A.owner.put(`/api/orders/${id}`, { data: { shipment: { mode: 'new', shipmentDate: '2026-11-26', items: [{ index: 0, shipped: 13 }] } } })).status()).toBe(400);
  // İkinci sevk: boş kalem = kalan (8); son sevkiyat
  const p2 = await A.owner.put(`/api/orders/${id}`, { data: { shipment: { mode: 'new', final: true, shipmentDate: '2026-11-27', deliveryNoteNo: 'K-2' } } });
  expect(p2.status(), await p2.text()).toBe(200);
  o = await (await A.owner.get(`/api/orders/${id}`)).json();
  expect(o.status).toBe('SHIPPED');
  expect(o.shipments.map((s: any) => s.totalQuantity)).toEqual([12, 8]);
  expect(o.shipment.deliveryNoteNo).toBe('K-2');
  expect(await prisma.orderStatusHistory.count({ where: { orderId: id, status: 'SHIPPED' } })).toBe(1);
  // Sevk edilen sipariş silinemez / geri alınamaz
  expect((await A.owner.delete(`/api/orders/${id}`)).status()).toBe(400);
  expect((await A.owner.put(`/api/orders/${id}`, { data: { status: 'IN_PRODUCTION' } })).status()).toBe(400);

  // Müşteri iki sevkiyatı ve irsaliyeyi görür; başkası göremez
  const mine = await (await M1.get(`/api/portal/me/orders/${id}`)).json();
  expect(mine.shipments).toHaveLength(2);
  const sid = mine.shipments[0].id;
  const note = await M1.get(`/api/portal/me/orders/${id}/delivery-note?shipment=${sid}`);
  expect(note.status()).toBe(200);
  const nd = await note.json();
  expect(nd.orderNo).toBe(o.orderNo);
  expect(nd.sequence).toEqual({ index: 1, count: 2 });
  expect(JSON.stringify(nd)).not.toContain('9.99');
  expect((await M2.get(`/api/portal/me/orders/${id}/delivery-note?shipment=${sid}`)).status()).toBe(404);
  expect((await B.owner.get(`/api/orders/${id}/delivery-note?shipment=${sid}`)).status()).toBe(404);
  expect((await A.owner.get(`/api/orders/${id}/delivery-note?shipment=${sid}`)).status()).toBe(200);
  // Başka siparişin sevkiyat kimliğiyle irsaliye alınamaz
  expect((await M1.get(`/api/portal/me/orders/${orderM2}/delivery-note?shipment=${sid}`)).status()).toBe(404);
});

// P-H6: satışa çevirme
test('satışa çevirme: başka müşterinin faturası, ikinci çevirme ve iptal sipariş reddedilir', async () => {
  const id = (await (await M1.post('/api/portal/me/orders', { data: { productId: pubA, sizeDistribution: { '38': 9 } } })).json()).id;
  const inv = (customerId: string, no: string) => prisma.invoice.create({ data: { companyId: A.companyId, customerId, invoiceNo: `${no}-${RUN}`, date: new Date() } });
  const other = await inv(custA2, 'F-X');
  expect((await A.owner.post(`/api/orders/${id}/mark-converted`, { data: { invoiceId: other.id } })).status()).toBe(400);
  const own = await inv(custA1, 'F-1');
  expect((await A.owner.post(`/api/orders/${id}/mark-converted`, { data: { invoiceId: own.id } })).status()).toBe(200);
  const own2 = await inv(custA1, 'F-2');
  expect((await A.owner.post(`/api/orders/${id}/mark-converted`, { data: { invoiceId: own2.id } })).status()).toBe(409);
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id } })).invoiceId).toBe(own.id);
});

// P-H3, P-H9: numara ve mükerrer gönderim
test('portal siparişi firmanın SIP- sırasından numara alır; aynı sipariş 60 sn içinde tekrar gönderilemez', async () => {
  const data = { productId: pubA, sizeDistribution: { '38': 11, '39': 4 }, notes: 'mükerrer deneme' };
  const r1 = await M1.post('/api/portal/me/orders', { data });
  expect(r1.status()).toBe(201);
  const o1 = await prisma.soleOrder.findUniqueOrThrow({ where: { id: (await r1.json()).id } });
  expect(o1.orderNo).toMatch(/^SIP-\d{4}-\d{4,}$/);
  expect((await M1.post('/api/portal/me/orders', { data })).status()).toBe(409);
  const r3 = await M1.post('/api/portal/me/orders', { data: { ...data, sizeDistribution: { '38': 12 } } });
  expect(r3.status()).toBe(201);
  const o3 = await prisma.soleOrder.findUniqueOrThrow({ where: { id: (await r3.json()).id } });
  const n = (x: string) => Number(x.split('-').at(-1));
  expect(n(o3.orderNo)).toBe(n(o1.orderNo) + 1);
});

// K4: firmanın açtığı sipariş de müşterinin listesinde, kaynağıyla
test('müşteri firmanın kendi adına açtığı siparişi de görür (kaynak: firma)', async () => {
  const r = await A.owner.post('/api/orders', { data: { customerId: custA1, productId: pubA, sizeDistribution: { '40': 6 } } });
  expect(r.status(), await r.text()).toBe(201);
  const id = (await r.json()).id;
  const list = await (await M1.get('/api/portal/me/orders')).json();
  const row = list.find((o: any) => o.id === id);
  expect(row?.source).toBe('firm');
  expect((await M2.get(`/api/portal/me/orders/${id}`)).status()).toBe(404);
});
