import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Sipariş süreci (satıcı + alıcı): durum doğrulama, sevkiyatın durumu güncellemesi,
// iptalin alıcıya yansıması, "Üretimde" sekmesinin ara aşamaları kapsaması, paket sipariş reçetesi.

let buyer: { companyId: string; owner: APIRequestContext };
let seller: { companyId: string; owner: APIRequestContext };
let linkId: string;
let kgA: string; let kgB: string;

test.beforeAll(async () => {
  buyer = await createCompany('surec-alici');
  seller = await createCompany('surec-satici');
  await prisma.company.update({ where: { id: seller.companyId }, data: { companyType: 'MATERIAL_SUPPLIER' } });
  const code = (await (await seller.owner.get('/api/network/code')).json()).code;
  kgA = (await prisma.product.create({ data: { companyId: seller.companyId, name: `PVC ${RUN}`, code: 'PVC', unit: 'kg', unitPrice: 2.4, portalVisible: true } })).id;
  kgB = (await prisma.product.create({ data: { companyId: seller.companyId, name: `TPR ${RUN}`, code: 'TPR', unit: 'kg', unitPrice: 3.1, portalVisible: true } })).id;
  linkId = (await (await buyer.owner.post('/api/network/links', { data: { code } })).json()).link.id;
  await seller.owner.post(`/api/network/links/${linkId}/approve`, { data: { createCustomer: true } });
});
test.afterAll(async () => { await cleanup(); });

async function placeOrder() {
  const r = await buyer.owner.post(`/api/network/links/${linkId}/orders`, {
    data: { orderItems: [{ productId: kgA, quantity: 1000 }, { productId: kgB, quantity: 250.5 }], requestedDeliveryDate: '2026-12-01' },
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).id as string;
}

test('satıcı detayı: kaynak bağlantı, kalem ürünleri; geçersiz durum 400', async () => {
  const id = await placeOrder();
  const d = await (await seller.owner.get(`/api/orders/${id}`)).json();
  expect(d.unit).toBe('kg');
  expect(d.link.buyerCompany.name).toBeTruthy();
  expect(d.itemProducts.map((p: any) => p.code).sort()).toEqual(['PVC', 'TPR']);
  expect((await seller.owner.put(`/api/orders/${id}`, { data: { status: 'UCUYOR' } })).status()).toBe(400);
  expect((await seller.owner.post(`/api/portal/orders/${id}/status`, { data: { status: 'UCUYOR' } })).status()).toBe(400);
});

test('"Üretimde" sekmesi ara üretim aşamalarını da listeler', async () => {
  const id = await placeOrder();
  await seller.owner.post(`/api/portal/orders/${id}/status`, { data: { status: 'PACKAGING' } });
  const list = await (await seller.owner.get('/api/orders?status=IN_PRODUCTION&from=2000-01-01')).json();
  expect(list.map((o: any) => o.id)).toContain(id);
  const cancelledTab = await (await seller.owner.get('/api/orders?status=CANCELLED&from=2000-01-01')).json();
  expect(cancelledTab.map((o: any) => o.id)).not.toContain(id);
});

test('sevkiyat kaydı siparişi "Sevk Edildi" yapar ve alıcı görür', async () => {
  const id = await placeOrder();
  expect((await seller.owner.put(`/api/orders/${id}`, { data: { shipment: { deliveryNoteNo: 'X' } } })).status()).toBe(400);
  const r = await seller.owner.put(`/api/orders/${id}`, { data: { shipment: { shipmentDate: '2026-11-25', deliveryNoteNo: 'IRS-1', carrier: 'Aras', notes: 'Paletli' } } });
  expect(r.status(), await r.text()).toBe(200);
  const row = await prisma.soleOrder.findUnique({ where: { id }, include: { shipment: true, statusHistory: true } });
  expect(row?.status).toBe('SHIPPED');
  expect(row?.shipment?.notes).toBe('Paletli');
  expect(row?.statusHistory.map(h => h.note)).toContain('İrsaliye: IRS-1 · 1.250,5 kg');
  const mine = await (await buyer.owner.get(`/api/network/orders/${id}`)).json();
  expect(mine.status).toBe('SHIPPED');
  expect(mine.shipment.deliveryNoteNo).toBe('IRS-1');

  // Sevkiyatı güncellemek ikinci bir "Sevk Edildi" kaydı açmaz
  await seller.owner.put(`/api/orders/${id}`, { data: { shipment: { shipmentDate: '2026-11-26', deliveryNoteNo: 'IRS-2' } } });
  expect(await prisma.orderStatusHistory.count({ where: { orderId: id, status: 'SHIPPED' } })).toBe(1);
});

test('satıcı iptal edince alıcı "İptal" olarak görür', async () => {
  const id = await placeOrder();
  expect((await seller.owner.delete(`/api/orders/${id}`)).status()).toBe(200);
  const mine = await (await buyer.owner.get(`/api/network/orders/${id}`)).json();
  expect(mine.status).toBe('CANCELLED');
  expect(mine.statusHistory.at(-1).note).toBe('Satıcı tarafından iptal edildi');
});

test('sevk edilen gerçek miktar: 1000 kg → 990, 250,5 kg → 260; fark geçmişte ve alıcıda', async () => {
  const id = await placeOrder();
  // Hatalı miktarlar reddedilir
  expect((await seller.owner.put(`/api/orders/${id}`, { data: { shipment: { shipmentDate: '2026-11-25', items: [{ index: 0, shipped: -5 }] } } })).status()).toBe(400);
  expect((await seller.owner.put(`/api/orders/${id}`, { data: { shipment: { shipmentDate: '2026-11-25', items: [{ index: 0, shipped: 0 }, { index: 1, shipped: 0 }] } } })).status()).toBe(400);

  const r = await seller.owner.put(`/api/orders/${id}`, {
    data: { shipment: { shipmentDate: '2026-11-25', deliveryNoteNo: 'IRS-9', items: [{ index: 0, shipped: 990 }, { index: 1, shipped: 260 }] } },
  });
  expect(r.status(), await r.text()).toBe(200);
  const row = await prisma.soleOrder.findUnique({ where: { id }, include: { shipment: true, statusHistory: true } });
  expect(row?.shipment?.totalQuantity).toBe(1250);
  expect((row?.shipment?.items as any[]).map(i => [i.ordered, i.shipped])).toEqual([[1000, 990], [250.5, 260]]);
  // Toplam 1250,5 sipariş → 1250 sevk: fark −0,5 kg
  expect(row?.statusHistory.find(h => h.status === 'SHIPPED')?.note).toBe('İrsaliye: IRS-9 · 1.250 kg (−0,5 kg)');

  const mine = await (await buyer.owner.get(`/api/network/orders/${id}`)).json();
  expect(mine.shipment.items.map((i: any) => i.shipped)).toEqual([990, 260]);
  expect(mine.shipment.totalQuantity).toBe(1250);

  // Portal yönetimi ucu da aynı kuralı kullanır (boş kalem = sipariş miktarı)
  const id2 = await placeOrder();
  const p = await seller.owner.post(`/api/portal/orders/${id2}/shipment`, { data: { shipmentDate: '2026-11-26', items: [{ index: 0, shipped: 1020 }] } });
  expect(p.status(), await p.text()).toBe(200);
  const s2 = await prisma.orderShipment.findUnique({ where: { orderId: id2 } });
  expect((s2?.items as any[]).map(i => i.shipped)).toEqual([1020, 250.5]);
});
