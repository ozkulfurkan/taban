import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Firma ağı: A (alıcı) B'nin (satıcı) kodunu girer, B onaylar, A B'ye sipariş verir.
// Firma ayrımı, roller, kod deneme sınırı ve katalog görünürlüğü.

let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let C: { companyId: string; owner: APIRequestContext };
let aViewer: APIRequestContext;
let bEditor: APIRequestContext;
let codeB: string;
let shown: string; let hidden: string; let restricted: string;

test.beforeAll(async () => {
  A = await createCompany('ag-alici');
  B = await createCompany('ag-satici');
  C = await createCompany('ag-yabanci');
  aViewer = await loggedIn(await createUser(A.companyId, 'ag-a-viewer', 'VIEWER'));
  bEditor = await loggedIn(await createUser(B.companyId, 'ag-b-editor', 'EDITOR'));
  await prisma.company.update({ where: { id: B.companyId }, data: { taxId: `TX${RUN}`.slice(0, 20) } });
  codeB = (await (await B.owner.get('/api/network/code')).json()).code;

  const mk = async (name: string, portalVisible: boolean) => {
    const p = await prisma.product.create({ data: { companyId: B.companyId, name: `${name} ${RUN}`, code: name, unitPrice: 9.5, portalVisible, sizes: ['38', '39'] } });
    return p.id;
  };
  shown = await mk('AG-ACIK', true);
  hidden = await mk('AG-GIZLI', false);
  restricted = await mk('AG-KISITLI', true);
  // Başka bir portal müşterisine kısıtlı ürün
  const other = await prisma.customer.create({ data: { companyId: B.companyId, name: `Başka ${RUN}` } });
  const pc = await prisma.portalCustomer.create({ data: { email: `ag-pc-${RUN}@test.local`, password: 'x', customerId: other.id } });
  await prisma.productPortalCustomer.create({ data: { productId: restricted, portalCustomerId: pc.id } });
});
test.afterAll(async () => {
  await prisma.portalCustomer.deleteMany({ where: { email: `ag-pc-${RUN}@test.local` } });
  await aViewer.dispose(); await bEditor.dispose(); await cleanup();
});

const order = (link: string, productId: string, extra: any = {}) => A.owner.post(`/api/network/links/${link}/orders`, {
  data: { orderItems: [{ productId, color: 'Siyah', sizeDistribution: { '38': 12, '39': 6 }, totalQuantity: 999 }], requestedDeliveryDate: '2026-12-20', notes: 'Ağ siparişi', ...extra },
});

test('kod biçimi ve yenileme yalnızca yönetici', async () => {
  expect(codeB).toMatch(/^SC-[2-9A-HJ-NP-Z]{6}$/);
  expect((await bEditor.post('/api/network/code')).status()).toBe(403);
  const again = (await (await B.owner.get('/api/network/code')).json()).code;
  expect(again).toBe(codeB);
});

test('istek → onay → katalog → sipariş → durum takibi', async () => {
  // Yazım farkları tolere edilir ("sc 7k4p9q")
  const loose = codeB.replace('SC-', 'sc ').toLowerCase();
  const req = await A.owner.post('/api/network/links', { data: { code: loose } });
  expect(req.status(), await req.text()).toBe(201);
  const { link } = await req.json();
  expect(link.status).toBe('PENDING');
  expect(Object.keys(link).sort()).toEqual(['id', 'sellerName', 'status', 'supplierId']);
  const supplier = await prisma.supplier.findUnique({ where: { id: link.supplierId } });
  expect(supplier?.companyId).toBe(A.companyId);
  expect(supplier?.taxId).toBe(`TX${RUN}`.slice(0, 20));

  // Aynı istek tekrar gönderilirse aynı bağlantı döner
  expect((await (await A.owner.post('/api/network/links', { data: { code: codeB } })).json()).link.id).toBe(link.id);

  // Onaysız bağlantıda katalog ve sipariş yok
  expect((await A.owner.get(`/api/network/links/${link.id}/catalog`)).status()).toBe(403);
  expect((await order(link.id, shown)).status()).toBe(403);

  // B'de bekleyen istek; düzenleyici onaylayamaz; alıcı kendi isteğini onaylayamaz
  const incoming = (await (await B.owner.get('/api/network/links')).json()).asSeller;
  expect(incoming.find((l: any) => l.id === link.id)?.status).toBe('PENDING');
  expect((await bEditor.post(`/api/network/links/${link.id}/approve`, { data: { createCustomer: true } })).status()).toBe(403);
  expect((await A.owner.post(`/api/network/links/${link.id}/approve`, { data: { createCustomer: true } })).status()).toBe(404);
  const ok = await B.owner.post(`/api/network/links/${link.id}/approve`, { data: { createCustomer: true } });
  expect(ok.status(), await ok.text()).toBe(200);
  const customerId = (await ok.json()).link.sellerCustomerId;
  expect((await prisma.customer.findUnique({ where: { id: customerId } }))?.companyId).toBe(B.companyId);

  // Katalog: yalnızca portalda açık ve kısıtsız ürün; fiyat ve firma kimliği yok
  const cat = await (await A.owner.get(`/api/network/links/${link.id}/catalog`)).json();
  expect(cat.products.map((p: any) => p.id)).toEqual([shown]);
  expect(Object.keys(cat.products[0]).sort()).toEqual(['code', 'description', 'id', 'imageUpdatedAt', 'name', 'purchased', 'sizes', 'unit']);

  // Katalog dışı ürün ve görüntüleyici reddedilir
  expect((await order(link.id, hidden)).status()).toBe(400);
  expect((await order(link.id, restricted)).status()).toBe(400);
  expect((await aViewer.post(`/api/network/links/${link.id}/orders`, { data: {} })).status()).toBe(403);

  const placed = await order(link.id, shown);
  expect(placed.status(), await placed.text()).toBe(201);
  const { id: orderId } = await placed.json();
  const row = await prisma.soleOrder.findUnique({ where: { id: orderId } });
  expect(row?.companyId).toBe(B.companyId);
  expect(row?.customerId).toBe(customerId);
  expect(row?.linkId).toBe(link.id);
  expect(row?.totalQuantity).toBe(18); // istemcinin 999'u değil, bedenlerin toplamı
  expect((row?.orderItems as any[])[0].productName).toBe(`AG-ACIK ${RUN}`);

  // B kendi sipariş listesinde görür, kaynak bilgisiyle
  const bOrders = await (await B.owner.get('/api/orders')).json();
  expect(bOrders.find((o: any) => o.id === orderId)?.link?.buyerCompany?.name).toBeTruthy();

  // B durumu günceller → A görür; A'nın yanıtında satıcı iç kimlikleri yok
  await prisma.soleOrder.update({ where: { id: orderId }, data: { status: 'MOLDING', statusHistory: { create: { status: 'MOLDING', note: 'Kalıpta' } } } });
  const mine = await (await A.owner.get('/api/network/orders')).json();
  const o = mine.find((x: any) => x.id === orderId);
  expect(o.status).toBe('MOLDING');
  expect(o.customerId).toBeUndefined();
  expect(o.companyId).toBeUndefined();
  expect(o.link.sellerCompany.name).toBeTruthy();
  const detail = await (await A.owner.get(`/api/network/orders/${orderId}`)).json();
  expect(detail.statusHistory.map((h: any) => h.note)).toContain('Kalıpta');

  // Yabancı firma ne bağlantıyı ne siparişi görür
  expect((await C.owner.get(`/api/network/links/${link.id}/catalog`)).status()).toBe(404);
  expect((await C.owner.post(`/api/network/links/${link.id}/orders`, { data: {} })).status()).toBe(404);
  expect((await C.owner.get(`/api/network/orders/${orderId}`)).status()).toBe(404);
  expect((await C.owner.delete(`/api/network/links/${link.id}`)).status()).toBe(404);

  // Satıcı bağlantıyı kaldırır: yeni sipariş yok, eski sipariş iki tarafta duruyor
  expect((await B.owner.delete(`/api/network/links/${link.id}`)).status()).toBe(200);
  expect((await order(link.id, shown)).status()).toBe(403);
  expect((await A.owner.get(`/api/network/orders/${orderId}`)).status()).toBe(200);
  expect(await prisma.soleOrder.count({ where: { id: orderId } })).toBe(1);

  // Kaldırılan bağlantı için yeniden istek gönderilebilir
  const re = await (await A.owner.post('/api/network/links', { data: { code: codeB } })).json();
  expect(re.link.id).toBe(link.id);
  expect(re.link.status).toBe('PENDING');
});

test('kendi kodu, reddetme ve yanlış kod sınırı', async () => {
  const own = (await (await C.owner.get('/api/network/code')).json()).code;
  expect((await C.owner.post('/api/network/links', { data: { code: own } })).status()).toBe(400);

  const r = await (await C.owner.post('/api/network/links', { data: { code: codeB } })).json();
  expect((await B.owner.post(`/api/network/links/${r.link.id}/reject`)).status()).toBe(200);
  expect((await B.owner.post(`/api/network/links/${r.link.id}/approve`, { data: { createCustomer: true } })).status()).toBe(409);
  expect((await C.owner.get(`/api/network/links/${r.link.id}/catalog`)).status()).toBe(403);

  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await C.owner.post('/api/network/links', { data: { code: 'SC-ZZZZZZ' } })).status());
  expect(statuses.slice(0, 10).every(s => s === 404)).toBeTruthy();
  expect(statuses[10]).toBe(429);
  await prisma.loginAttempt.deleteMany({ where: { key: `link-code:${C.companyId}` } });
});

test('birime göre sipariş: kg miktarla, çift asortiyle; birim kuralları sunucuda', async () => {
  const buyer = await createCompany('ag-birim-alici');
  const seller = await createCompany('ag-birim-satici');
  const code = (await (await seller.owner.get('/api/network/code')).json()).code;
  const mk = (name: string, unit: string) => prisma.product.create({
    data: { companyId: seller.companyId, name: `${name} ${RUN}`, code: name, unit, portalVisible: true, sizes: ['40'] },
  });
  const kg = await mk('PVC-GRANUL', 'kg');
  const adet = await mk('KOLI', 'adet');
  const taban = await mk('TABAN', 'çift');

  const { link } = await (await buyer.owner.post('/api/network/links', { data: { code } })).json();
  await seller.owner.post(`/api/network/links/${link.id}/approve`, { data: { createCustomer: true } });

  const cat = await (await buyer.owner.get(`/api/network/links/${link.id}/catalog`)).json();
  expect(Object.fromEntries(cat.products.map((p: any) => [p.code, p.unit]))).toEqual({ 'PVC-GRANUL': 'kg', KOLI: 'adet', TABAN: 'çift' });

  const send = (orderItems: any[]) => buyer.owner.post(`/api/network/links/${link.id}/orders`, { data: { orderItems } });

  // kg: ondalıklı miktar, beden yok, renk zorunlu değil
  const ok = await send([{ productId: kg.id, quantity: 1250.5, sizeDistribution: { '40': 99 }, totalQuantity: 1 }]);
  expect(ok.status(), await ok.text()).toBe(201);
  const row = await prisma.soleOrder.findUnique({ where: { id: (await ok.json()).id } });
  expect(row?.unit).toBe('kg');
  expect(row?.totalQuantity).toBe(1250.5);
  expect(row?.sizeDistribution).toEqual({});
  expect((row?.orderItems as any[])[0]).toMatchObject({ unit: 'kg', quantity: 1250.5, totalQuantity: 1250.5, productName: `PVC-GRANUL ${RUN}` });
  const mine = await (await buyer.owner.get(`/api/network/orders/${row!.id}`)).json();
  expect(mine.unit).toBe('kg');

  // Hatalı miktarlar ve karışık birim reddedilir
  expect((await send([{ productId: kg.id, quantity: 0 }])).status()).toBe(400);
  expect((await send([{ productId: adet.id, quantity: 2.5 }])).status()).toBe(400);
  expect((await send([{ productId: taban.id, color: 'Siyah', sizeDistribution: {} }])).status()).toBe(400);
  const mixed = await send([{ productId: kg.id, quantity: 5 }, { productId: taban.id, color: 'Siyah', sizeDistribution: { '40': 6 } }]);
  expect(mixed.status()).toBe(400);
  expect((await mixed.json()).error).toContain('ayrı siparişlerde');

  // Çift: eskisi gibi asorti, birim alanı boş (çift)
  const pair = await send([{ productId: taban.id, color: 'Siyah', sizeDistribution: { '40': 6 } }]);
  const pairRow = await prisma.soleOrder.findUnique({ where: { id: (await pair.json()).id } });
  expect(pairRow?.unit).toBeNull();
  expect(pairRow?.totalQuantity).toBe(6);
  await buyer.owner.dispose(); await seller.owner.dispose();
});
