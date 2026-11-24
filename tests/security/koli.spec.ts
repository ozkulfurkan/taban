import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from './helpers';

// Koli etiketi: firma ayrımı, tekrar etmeyen barkod, stok girişi ve hammaddeci kısıtı

let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let M: { companyId: string; owner: APIRequestContext };

test.beforeAll(async () => {
  A = await createCompany('koli-a');
  B = await createCompany('koli-b');
  M = await createCompany('koli-m');
  await prisma.company.update({ where: { id: M.companyId }, data: { companyType: 'MATERIAL_SUPPLIER' } });
});
test.afterAll(async () => { await cleanup(); });

test('koli etiketi: barkodlar ardışık ve tekrar etmez; okutunca içerik gelir; stok toplam kadar artar', async () => {
  const product = await prisma.product.create({ data: { companyId: A.companyId, name: `Koli Taban ${RUN}`, code: 'KT-1', unit: 'çift', stock: 10 } });
  const customer = await prisma.customer.create({ data: { companyId: A.companyId, name: `Koli Müşteri ${RUN}` } });

  const r1 = await A.owner.post('/api/koli', {
    data: { mode: 'single', rows: [{ size: '37', qty: 40, boxes: 2 }, { size: '38', qty: 40, boxes: 1 }], productId: product.id, customerId: customer.id, color: 'Siyah', addToStock: true },
  });
  expect(r1.status(), await r1.text()).toBe(201);
  const l1 = (await r1.json()).labels;
  expect(l1).toHaveLength(3);
  expect(l1[0]).toMatchObject({ productName: product.name, productCode: 'KT-1', customerName: customer.name, sizes: { '37': 40 }, boxIndex: 1, boxCount: 2 });
  expect(l1[0].companyId).toBeUndefined();

  const r2 = await A.owner.post('/api/koli', { data: { mode: 'mixed', rows: [{ size: '36', qty: 1 }, { size: '37', qty: 2 }], boxCount: 2, productId: product.id } });
  const l2 = (await r2.json()).labels;
  const all = [...l1, ...l2].map((l: any) => l.barcode);
  expect(new Set(all).size).toBe(5);
  const seq = all.map(b => Number(b.split('-')[1]));
  expect(seq).toEqual(seq.map((_, i) => seq[0] + i));
  expect(l2[0].totalQuantity).toBe(3);

  expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10 + 120);

  const found = await A.owner.get(`/api/koli?barcode=${encodeURIComponent(l2[1].barcode)}`);
  expect(found.status()).toBe(200);
  expect((await found.json()).sizes).toEqual({ '36': 1, '37': 2 });
  // Başka firma aynı barkodu göremez
  expect((await B.owner.get(`/api/koli?barcode=${encodeURIComponent(l2[1].barcode)}`)).status()).toBe(404);
  expect(await (await B.owner.get('/api/koli')).json()).toEqual([]);
});

test('koli etiketi: başka firmanın ürünü, müşterisi ya da siparişi kullanılamaz', async () => {
  const pB = await prisma.product.create({ data: { companyId: B.companyId, name: `B ürün ${RUN}` } });
  const cB = await prisma.customer.create({ data: { companyId: B.companyId, name: `B müşteri ${RUN}` } });
  const oB = await prisma.soleOrder.create({ data: { companyId: B.companyId, customerId: cB.id, orderNo: `B-${RUN}`, sizeDistribution: { '37': 1 }, totalQuantity: 1 } });
  const rows = [{ size: '37', qty: 1 }];
  for (const ref of [{ productId: pB.id }, { customerId: cB.id }, { orderId: oB.id }]) {
    const r = await A.owner.post('/api/koli', { data: { mode: 'mixed', rows, productName: 'X', ...ref } });
    expect(r.status(), JSON.stringify(ref)).toBe(404);
  }
  expect(await prisma.koli.count({ where: { companyId: A.companyId, productName: 'X' } })).toBe(0);
  const empty = await A.owner.post('/api/koli', { data: { mode: 'mixed', rows: [{ size: '37', qty: 0 }], productName: 'X' } });
  expect(empty.status()).toBe(400);
});

test('koli etiketi hammaddeci firmalara kapalı (onlar barkod etiketini kullanır)', async () => {
  const r = await M.owner.post('/api/koli', { data: { mode: 'mixed', rows: [{ size: '37', qty: 1 }], productName: 'X' } });
  expect(r.status()).toBe(403);
  expect(await prisma.koli.count({ where: { companyId: M.companyId } })).toBe(0);
});
