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

test('satış cari hesaptan silinince fiş "işlenmedi"ye döner ve yeniden işlenir; eski POSTED kayıt da işlenir', async () => {
  const o = await order(pSpecial, { '40': 6 });
  const r = await A.owner.post('/api/dispatches', { data: { customerId: cust, post: true, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 6 }] } });
  expect(r.status(), await r.text()).toBe(201);
  const d = await r.json();
  expect(d.posted, d.postError).toBe(true);
  expect((await A.owner.delete(`/api/invoices/${d.invoice.id}`)).status()).toBe(200);
  const back = await prisma.dispatch.findUniqueOrThrow({ where: { id: d.id } });
  expect([back.status, back.invoiceId]).toEqual(['DRAFT', null]);
  expect((await prisma.orderShipment.findFirstOrThrow({ where: { dispatchId: d.id } })).invoiceId).toBeNull();
  const again = await A.owner.post(`/api/dispatches/${d.id}/post`, { data: {} });
  expect(again.status(), await again.text()).toBe(200);
  // Eski davranıştan kalan kayıt: POSTED ama satışı yok
  const inv2 = (await again.json()).invoice.id;
  await prisma.dispatch.update({ where: { id: d.id }, data: { invoiceId: null, status: 'POSTED' } });
  await prisma.orderShipment.updateMany({ where: { dispatchId: d.id }, data: { invoiceId: 'silinmis-fatura' } });
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv2 } }); await prisma.invoice.delete({ where: { id: inv2 } });
  const list = await (await A.owner.get('/api/dispatches')).json();
  expect(list.find((x: any) => x.id === d.id).status).toBe('DRAFT');
  expect((await A.owner.post(`/api/dispatches/${d.id}/post`, { data: {} })).status()).toBe(200);
});

test('fiş silinir: satış silinir, stok geri gelir, sevkiyat geri alınır, sipariş yeniden açılır; tahsilat caride kalır', async () => {
  const o = await order(pSpecial, { '41': 5 });
  const before = (await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock;
  const d = await (await A.owner.post('/api/dispatches', { data: { customerId: cust, post: true, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 5 }] } })).json();
  expect((await prisma.soleOrder.findUniqueOrThrow({ where: { id: o } })).status).toBe('SHIPPED');
  expect((await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock).toBe(before - 5);
  // Tahsilat faturaya bağlanmaz: fiş silinse de caride kalır
  const pay = await (await A.owner.post('/api/payments', { data: { customerId: cust, invoiceId: d.invoice.id, amount: 10, currency: 'TRY', method: 'Nakit' } })).json();
  expect(pay.invoiceId).toBeNull();
  // Nakliyeci hesaba işlenmiş fişi düzenleyemez; başka firma göremez
  expect((await driver.put(`/api/dispatches/${d.id}`, { data: { customerId: cust, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 1 }] } })).status()).toBe(403);
  expect((await B.owner.delete(`/api/dispatches/${d.id}`)).status()).toBe(404);
  expect((await B.owner.put(`/api/dispatches/${d.id}`, { data: {} })).status()).toBe(404);
  // Sil
  expect((await A.owner.delete(`/api/dispatches/${d.id}`)).status()).toBe(200);
  expect(await prisma.dispatch.findUnique({ where: { id: d.id } })).toBeNull();
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).amount).toBe(10);
  expect(await prisma.invoice.findUnique({ where: { id: d.invoice.id } })).toBeNull();
  expect((await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock).toBe(before);
  const ord = await prisma.soleOrder.findUniqueOrThrow({ where: { id: o }, include: { shipments: true } });
  expect([ord.status, ord.shipments.length]).toEqual(['READY_FOR_SHIPMENT', 0]);
});

test('fiş düzenlenir: miktar ve fiyat değişince satış aynı fiş numarasıyla yeniden oluşur, stok doğru kalır', async () => {
  const o = await order(pSpecial, { '42': 10 });
  const before = (await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock;
  const d = await (await A.owner.post('/api/dispatches', { data: { customerId: cust, post: true, vatRate: 0, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 4 }] } })).json();
  expect(d.posted).toBe(true);
  // Düzenleme ekranı: bu fişin sevkiyatı kalandan düşülmez
  const ol = await (await A.owner.get(`/api/dispatches/open-lines?customerId=${cust}&excludeDispatchId=${d.id}`)).json();
  expect(ol.orders.find((x: any) => x.orderId === o).lines[0].remaining).toBe(10);
  const r = await A.owner.put(`/api/dispatches/${d.id}`, {
    data: { customerId: cust, post: true, vatRate: 0, carrier: 'Aras', lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 10, unitPrice: 90 }, { productId: pNone, name: 'Ek', qty: 2, unitPrice: 5 }] },
  });
  expect(r.status(), await r.text()).toBe(200);
  const u = await r.json();
  expect([u.no, u.posted, u.carrier]).toEqual([d.no, true, 'Aras']);
  expect(await prisma.invoice.findUnique({ where: { id: d.invoice.id } })).toBeNull();
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: u.invoice.id } });
  expect([inv.subtotal, inv.irsaliyeNo]).toEqual([910, d.no]);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: pSpecial } })).stock).toBe(before - 10);
  const ord = await prisma.soleOrder.findUniqueOrThrow({ where: { id: o }, include: { shipments: true } });
  expect([ord.status, ord.shipments.length, ord.shipments[0].totalQuantity]).toEqual(['SHIPPED', 1, 10]);
  // Geçersiz düzenleme hiçbir şeyi bozmaz
  expect((await A.owner.put(`/api/dispatches/${d.id}`, { data: { customerId: cust, lines: [{ orderId: o, orderLineIndex: 0, name: 'x', qty: 500 }] } })).status()).toBe(400);
  expect((await prisma.dispatch.findUniqueOrThrow({ where: { id: d.id } })).invoiceId).toBe(u.invoice.id);
});
