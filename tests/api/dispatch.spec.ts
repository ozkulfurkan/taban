import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Sevk fişi: açık sipariş kalemleri, fiyat sırası (müşteri fiyatı → liste → elle), cari hesaba işleme (satış, KDV, stok),
// fiyatsız fişin taslak kalması, kısmi/son sevkiyat, çift işleme koruması, nakliyeci yetkisi ve firma ayrımı.
let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let cust: string; let custUsd: string; let pSpecial: string; let pList: string; let pNone: string;
let driver: APIRequestContext;

test.beforeAll(async () => {
  A = await createCompany('svk-a');
  B = await createCompany('svk-b');
  await prisma.company.update({ where: { id: A.companyId }, data: { usdToTry: 40, eurToTry: 45 } });
  cust = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri ${RUN}`, currency: 'TRY' } })).id;
  custUsd = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Dolar Müşteri ${RUN}`, currency: 'USD' } })).id;
  const mk = async (code: string, unitPrice: number, currency = 'TRY', unit = 'çift') =>
    (await prisma.product.create({ data: { companyId: A.companyId, name: `${code} ${RUN}`, code, unitPrice, currency, unit, stock: 1000 } })).id;
  pSpecial = await mk('SV-OZ', 100);
  pList = await mk('SV-LST', 2.5, 'USD');
  pNone = await mk('SV-YOK', 0, 'TRY', 'kg');
  await prisma.customerProductPrice.create({ data: { companyId: A.companyId, customerId: cust, productId: pSpecial, unitPrice: 80, currency: 'TRY' } });
  driver = await loggedIn(await createUser(A.companyId, 'svk-nakliye', 'EDITOR', ['sevkiyat']));
});
test.afterAll(async () => { await driver.dispose(); await cleanup(); });

const order = async (productId: string, sizes: Record<string, number>, customerId = cust) => {
  const r = await A.owner.post('/api/orders', { data: { customerId, productId, sizeDistribution: sizes, notes: `svk ${Math.random()}` } });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).id as string;
};

test('açık sipariş kalemleri ve fiyat sırası: müşteri fiyatı > liste fiyatı (kurla çevrilmiş) > yok', async () => {
  const o1 = await order(pSpecial, { '40': 10 });
  const o2 = await order(pList, { '41': 4 });
  const d = await (await A.owner.get(`/api/dispatches/open-lines?customerId=${cust}`)).json();
  const lines = d.orders.flatMap((o: any) => o.lines.map((l: any) => ({ ...l, orderId: o.orderId })));
  const l1 = lines.find((l: any) => l.orderId === o1); const l2 = lines.find((l: any) => l.orderId === o2);
  expect([l1.remaining, l1.price]).toEqual([10, { unitPrice: 80, source: 'special', converted: false, originalCurrency: 'TRY' }]);
  expect(l2.price).toEqual({ unitPrice: 100, source: 'list', converted: true, originalCurrency: 'USD' }); // 2,5 USD × 40
  const extra = await (await A.owner.get(`/api/dispatches/open-lines?customerId=${cust}&productIds=${pNone}`)).json();
  expect(extra.prices[pNone]).toBeUndefined();
  // Nakliyeci (yalnız Sevkiyat izni) kalemleri görür ama fiyat görmez
  const nd = await (await driver.get(`/api/dispatches/open-lines?customerId=${cust}`)).json();
  expect(nd.canPrice).toBe(false);
  expect(JSON.stringify(nd)).not.toContain('"unitPrice"');
});

test('sevk fişi + cari hesaba işle: kısmi sevkiyat, satış (KDV dahil), stok düşer; ikinci işleme yok', async () => {
  const o = await order(pSpecial, { '40': 10, '41': 10 });
  const before = (await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock;
  const r = await A.owner.post('/api/dispatches', {
    data: { customerId: cust, vatRate: 20, post: true, carrier: 'Kendi aracımız', vehiclePlate: '34 ABC 123',
      lines: [{ orderId: o, orderLineIndex: 0, productId: pSpecial, name: 'x', qty: 12 }, { productId: pNone, name: 'Siparişsiz kg', qty: '2,5', unitPrice: 40 }] },
  });
  expect(r.status(), await r.text()).toBe(201);
  const d = await r.json();
  expect(d.no).toMatch(/^SVK-\d{4}-\d{4}$/);
  expect(d.posted).toBe(true);
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: d.invoice.id }, include: { items: true } });
  // 12 × 80 + 2,5 × 40 = 1060; KDV %20 = 212
  expect([inv.subtotal, inv.vatAmount, inv.total, inv.irsaliyeNo]).toEqual([1060, 212, 1272, d.no]);
  expect(inv.customerId).toBe(cust);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock).toBe(before - 12);
  // Kısmi sevk: sipariş kapanmaz, sevkiyat fişe ve satışa bağlı
  const ord = await prisma.soleOrder.findUniqueOrThrow({ where: { id: o }, include: { shipments: true } });
  expect(ord.status).not.toBe('SHIPPED');
  expect(ord.shipments).toHaveLength(1);
  expect([ord.shipments[0].dispatchId, ord.shipments[0].invoiceId, ord.shipments[0].totalQuantity]).toEqual([d.id, inv.id, 12]);
  // Tekrar işleme ve "Satışa Çevir" engellenir
  expect((await A.owner.post(`/api/dispatches/${d.id}/post`, { data: {} })).status()).toBe(409);
  const other = await prisma.invoice.create({ data: { companyId: A.companyId, customerId: cust, invoiceNo: `X-${RUN}`, date: new Date() } });
  expect((await A.owner.post(`/api/orders/${o}/mark-converted`, { data: { invoiceId: other.id } })).status()).toBe(409);
  // Kalan sevk: son sevkiyat siparişi kapatır
  const r2 = await A.owner.post('/api/dispatches', { data: { customerId: cust, post: false, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 8 }] } });
  expect(r2.status(), await r2.text()).toBe(201);
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id: o } })).status).toBe('SHIPPED');
});

test('fiyatı eksik fiş taslak kalır; yetkili fiyatı girip sonradan işler', async () => {
  const r = await A.owner.post('/api/dispatches', { data: { customerId: cust, post: true, lines: [{ productId: pNone, name: 'Fiyatsız', qty: 3 }] } });
  expect(r.status()).toBe(201);
  const d = await r.json();
  expect([d.posted, d.status, d.invoiceId]).toEqual([false, 'DRAFT', null]);
  expect(d.postError).toContain('Fiyatı girilmemiş');
  const p = await A.owner.post(`/api/dispatches/${d.id}/post`, { data: { prices: { 0: 15 } } });
  expect(p.status(), await p.text()).toBe(200);
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: (await p.json()).invoice.id } })).subtotal).toBe(45);
});

test('nakliyeci: fiş keser ama fiyat giremez ve hesaba işleyemez; satış ve ayar uçlarına giremez', async () => {
  const r = await driver.post('/api/dispatches', { data: { customerId: cust, post: true, lines: [{ productId: pSpecial, name: 'x', qty: 2, unitPrice: 1 }] } });
  expect(r.status(), await r.text()).toBe(201);
  const d = await r.json();
  expect(d.posted).toBe(false);
  const saved = await prisma.dispatch.findUniqueOrThrow({ where: { id: d.id } });
  expect((saved.lines as any[])[0].unitPrice).toBe(80); // elle girilen 1 değil, müşteri fiyatı
  expect((await driver.post(`/api/dispatches/${d.id}/post`, { data: {} })).status()).toBe(403);
  const view = await (await driver.get(`/api/dispatches/${d.id}`)).json();
  expect([view.lines[0].unitPrice, view.total, view.canPrice]).toEqual([null, null, false]);
  expect((await driver.put('/api/print-settings', { data: { paper: 'A5' } })).status()).toBe(403);
  // Yönetici işler
  expect((await A.owner.post(`/api/dispatches/${d.id}/post`, { data: {} })).status()).toBe(200);
});

test('firma ayrımı ve doğrulama', async () => {
  const o = await order(pSpecial, { '42': 5 });
  const custB = (await prisma.customer.create({ data: { companyId: B.companyId, name: `B ${RUN}` } })).id;
  expect((await B.owner.get(`/api/dispatches/open-lines?customerId=${cust}`)).status()).toBe(404);
  expect((await B.owner.post('/api/dispatches', { data: { customerId: custB, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 1 }] } })).status()).toBe(404);
  expect((await B.owner.post('/api/dispatches', { data: { customerId: custB, lines: [{ productId: pSpecial, name: 'x', qty: 1 }] } })).status()).toBe(404);
  const mine = (await (await A.owner.get('/api/dispatches')).json())[0];
  expect((await B.owner.get(`/api/dispatches/${mine.id}`)).status()).toBe(404);
  expect((await B.owner.post(`/api/dispatches/${mine.id}/post`, { data: {} })).status()).toBe(404);
  expect(JSON.stringify(await (await B.owner.get('/api/dispatches')).json())).not.toContain(mine.id);
  // Başka müşterinin siparişi, fazla sevk, geçersiz miktar
  expect((await A.owner.post('/api/dispatches', { data: { customerId: custUsd, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 1 }] } })).status()).toBe(400);
  expect((await A.owner.post('/api/dispatches', { data: { customerId: cust, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 50 }] } })).status()).toBe(400);
  expect((await A.owner.post('/api/dispatches', { data: { customerId: cust, lines: [{ productId: pSpecial, name: 'x', qty: -2 }] } })).status()).toBe(400);
  expect((await A.owner.post('/api/dispatches', { data: { customerId: cust, lines: [] } })).status()).toBe(400);
});

test('yazdırma ayarları: kaydedilir, sınırlar uygulanır', async () => {
  const r = await A.owner.put('/api/print-settings', { data: { paper: 'CF240x140', mode: 'preprinted', fontSizePt: 99, copies: 9, showPrices: true, fieldPositions: { customer: { x: 25, y: 30 } } } });
  expect(r.status(), await r.text()).toBe(200);
  const s = await (await A.owner.get('/api/print-settings')).json();
  expect([s.paper, s.widthMm, s.heightMm, s.mode, s.fontSizePt, s.copies, s.showPrices, s.fieldPositions.customer]).toEqual(['CF240x140', 240, 140, 'preprinted', 16, 5, true, { x: 25, y: 30 }]);
});
