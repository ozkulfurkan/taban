import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Ortak belge ekranının arkasındaki API: alış kalemleri ve stok, alış düzenleme,
// alış silme, fatura irsaliye bilgileri.

let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };

test.beforeAll(async () => {
  A = await createCompany('belge');
  B = await createCompany('belge-b');
});
test.afterAll(async () => { await cleanup(); });

const uniq = (p: string) => `${p} ${RUN} ${Math.random().toString(36).slice(2, 7)}`;

async function supplier(currency = 'USD') {
  const r = await A.owner.post('/api/suppliers', { data: { name: uniq('Tedarikçi'), currency } });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).id as string;
}
async function material(stock = 0) {
  const m = await (await A.owner.post('/api/materials', { data: { name: uniq('Kauçuk'), pricePerKg: 2, currency: 'USD' } })).json();
  if (stock) await prisma.material.update({ where: { id: m.id }, data: { stock } });
  return m.id as string;
}
async function product(stock = 0) {
  return (await (await A.owner.post('/api/products', { data: { name: uniq('Taban'), stock, unitPrice: 5, currency: 'USD' } })).json()).id as string;
}
const materialStock = async (id: string) => (await prisma.material.findUnique({ where: { id } }))!.stock;
const productStock = async (id: string) => (await prisma.product.findUnique({ where: { id } }))!.stock;

test('alış: hammadde ve ürün stoğu artar, toplam kalemlerden hesaplanır', async () => {
  const s = await supplier();
  const m = await material(10);
  const p = await product(3);
  const r = await A.owner.post('/api/purchases', {
    data: { supplierId: s, total: 1, items: [{ materialId: m, qty: '12,5', unitPrice: '2,40' }, { productId: p, qty: 4, unitPrice: 10 }] },
  });
  expect(r.status(), await r.text()).toBe(201);
  const purchase = await r.json();
  expect(purchase.total).toBe(70); // 12,5 × 2,40 + 4 × 10 (gönderilen total yok sayılır)
  expect(await materialStock(m)).toBe(22.5);
  expect(await productStock(p)).toBe(7);

  const detail = await (await A.owner.get(`/api/purchases/${purchase.id}`)).json();
  expect(detail.purchaseMaterials).toHaveLength(2);
  expect(detail.purchaseMaterials.map((x: any) => x.material?.name ?? x.product?.name)).toHaveLength(2);
});

test('alış düzenleme: kalem değişince stok farkı ve ödeme durumu düzelir', async () => {
  const s = await supplier();
  const m1 = await material();
  const m2 = await material();
  const p = await product();
  const purchase = await (await A.owner.post('/api/purchases', {
    data: { supplierId: s, items: [{ materialId: m1, qty: 10, unitPrice: 5 }, { productId: p, qty: 5, unitPrice: 10 }] },
  })).json();
  expect(purchase.total).toBe(100);

  const pay = await A.owner.post('/api/payments', {
    data: { purchaseId: purchase.id, supplierId: s, amount: 50, currency: 'USD', method: 'Nakit', date: new Date().toISOString() },
  });
  expect(pay.status(), await pay.text()).toBeLessThan(300);
  expect((await prisma.purchase.findUnique({ where: { id: purchase.id } }))!.status).toBe('PARTIAL');

  // m1 10 → 4 kg, ürün kalemi çıkar, m2 eklenir; toplam 4×5 + 2×10 = 40 → ödenen 50 ile kapanır
  const r = await A.owner.put(`/api/purchases/${purchase.id}`, {
    data: { notes: 'düzeltildi', items: [{ materialId: m1, qty: 4, unitPrice: 5 }, { materialId: m2, qty: 2, unitPrice: 10 }] },
  });
  expect(r.status(), await r.text()).toBe(200);
  expect(await materialStock(m1)).toBe(4);
  expect(await materialStock(m2)).toBe(2);
  expect(await productStock(p)).toBe(0);
  const after = (await prisma.purchase.findUnique({ where: { id: purchase.id } }))!;
  expect(after.total).toBe(40);
  expect(after.status).toBe('PAID');
  expect(after.notes).toBe('düzeltildi');
  expect(await prisma.purchaseMaterial.count({ where: { purchaseId: purchase.id } })).toBe(2);
});

test('alış düzenleme: sadece başlık değişirse kalemler ve stok aynen kalır', async () => {
  const s = await supplier();
  const m = await material();
  const purchase = await (await A.owner.post('/api/purchases', { data: { supplierId: s, items: [{ materialId: m, qty: 3, unitPrice: 1 }] } })).json();
  const r = await A.owner.put(`/api/purchases/${purchase.id}`, { data: { invoiceNo: `ALF-${RUN}`, notes: 'sadece not' } });
  expect(r.status()).toBe(200);
  expect(await materialStock(m)).toBe(3);
  expect(await prisma.purchaseMaterial.count({ where: { purchaseId: purchase.id } })).toBe(1);
  expect((await prisma.purchase.findUnique({ where: { id: purchase.id } }))!.invoiceNo).toBe(`ALF-${RUN}`);
});

test('alış silme ürün stoğunu da geri alır', async () => {
  const s = await supplier();
  const p = await product(1);
  const m = await material(1);
  const purchase = await (await A.owner.post('/api/purchases', {
    data: { supplierId: s, items: [{ productId: p, qty: 6, unitPrice: 1 }, { materialId: m, qty: 2, unitPrice: 1 }] },
  })).json();
  expect(await productStock(p)).toBe(7);
  expect((await A.owner.delete(`/api/purchases/${purchase.id}`)).status()).toBe(200);
  expect(await productStock(p)).toBe(1);
  expect(await materialStock(m)).toBe(1);
});

test('fasoncu deposuna alış ve düzenlemede ana depoya taşıma', async () => {
  const s = await supplier();
  const m = await material(0);
  const sub = await (await A.owner.post('/api/subcontractors', { data: { name: uniq('Fasoncu') } })).json();
  const purchase = await (await A.owner.post('/api/purchases', {
    data: { supplierId: s, items: [{ materialId: m, subcontractorId: sub.id, qty: 8, unitPrice: 1 }] },
  })).json();
  const subStock = async () => (await prisma.subcontractorStock.findFirst({ where: { subcontractorId: sub.id, materialId: m } }))?.quantity ?? 0;
  expect(await subStock()).toBe(8);
  expect(await materialStock(m)).toBe(0);

  await A.owner.put(`/api/purchases/${purchase.id}`, { data: { items: [{ materialId: m, qty: 5, unitPrice: 1 }] } });
  expect(await subStock()).toBe(0);
  expect(await materialStock(m)).toBe(5);
});

test('alış kalem doğrulaması ve firma ayrımı', async () => {
  const s = await supplier();
  const m = await material();
  const purchase = await (await A.owner.post('/api/purchases', { data: { supplierId: s, items: [{ materialId: m, qty: 1, unitPrice: 1 }] } })).json();
  for (const items of [[], [{ qty: 1, unitPrice: 1 }], [{ materialId: m, qty: 0, unitPrice: 1 }], [{ materialId: m, qty: 1, unitPrice: 0 }]]) {
    const r = await A.owner.put(`/api/purchases/${purchase.id}`, { data: { items } });
    expect(r.status(), JSON.stringify(items)).toBe(400);
  }
  expect(await materialStock(m)).toBe(1); // başarısız denemeler stoğa dokunmaz

  const foreignMat = await (await B.owner.post('/api/materials', { data: { name: uniq('Yabancı'), pricePerKg: 1, currency: 'USD' } })).json();
  const r = await A.owner.put(`/api/purchases/${purchase.id}`, { data: { items: [{ materialId: foreignMat.id, qty: 1, unitPrice: 1 }] } });
  expect([400, 403, 404]).toContain(r.status());
  expect((await B.owner.put(`/api/purchases/${purchase.id}`, { data: { notes: 'x' } })).status()).toBe(404);
});

test('fatura irsaliye no ve sevk tarihi kaydedilir ve düzenlenir', async () => {
  const c = await (await A.owner.post('/api/customers', { data: { name: uniq('Müşteri'), currency: 'TRY' } })).json();
  const inv = await (await A.owner.post('/api/invoices', {
    data: { customerId: c.id, irsaliyeNo: 'IRS-1', sevkTarihi: '2026-11-20', items: [{ description: 'Taban', quantity: 1, unitPrice: 10 }] },
  })).json();
  let saved = (await prisma.invoice.findUnique({ where: { id: inv.id } }))!;
  expect(saved.irsaliyeNo).toBe('IRS-1');
  expect(saved.sevkTarihi?.toISOString().slice(0, 10)).toMatch(/2026-11-(19|20)/);

  await A.owner.put(`/api/invoices/${inv.id}`, { data: { irsaliyeNo: 'IRS-2' } });
  saved = (await prisma.invoice.findUnique({ where: { id: inv.id } }))!;
  expect(saved.irsaliyeNo).toBe('IRS-2');
  expect(saved.sevkTarihi).not.toBeNull();
});

test.describe('tedarikçiye mal iadesi', () => {
  test('iade stoğu düşürür, borcu azaltır; liste, detay ve ekstre aynı bakiyeyi verir', async () => {
    const s = await supplier();
    const m = await material(0);
    const p = await product(0);
    await A.owner.post('/api/purchases', { data: { supplierId: s, items: [{ materialId: m, qty: 10, unitPrice: 5 }, { productId: p, qty: 6, unitPrice: 10 }] } });

    const r = await A.owner.post('/api/purchases', {
      data: { supplierId: s, isReturn: true, items: [{ materialId: m, qty: 4, unitPrice: 5 }, { productId: p, qty: 1, unitPrice: 10 }] },
    });
    expect(r.status(), await r.text()).toBe(201);
    const ret = await r.json();
    expect(ret.isReturn).toBe(true);
    expect(ret.total).toBe(30);
    expect(ret.invoiceNo).toMatch(/^ALI-\d{4}-/);
    expect(await materialStock(m)).toBe(6);
    expect(await productStock(p)).toBe(5);

    const detail = await (await A.owner.get(`/api/suppliers/${s}`)).json();
    expect(detail.totalPurchased).toBe(80); // 110 alış − 30 iade
    expect(detail.balance).toBe(80);
    const list = await (await A.owner.get('/api/suppliers')).json();
    expect((Array.isArray(list) ? list : list.suppliers).find((x: any) => x.id === s).balance).toBe(80);
    const ekstre = await (await A.owner.get(`/api/suppliers/${s}/ekstre`)).json();
    expect(ekstre.totalDebit).toBe(110);
    expect(ekstre.totalCredit).toBe(30);
    expect(ekstre.balance).toBe(80);

    const mat = await (await A.owner.get(`/api/materials/${m}/ekstre`)).json();
    const rows = Array.isArray(mat) ? mat : mat.entries ?? mat.items ?? [];
    expect(rows.some((e: any) => e.type === 'alis_iade' && e.kgAmount === -4)).toBe(true);
  });

  test('iade düzenlenince stok farkı düzelir, silinince stok geri gelir', async () => {
    const s = await supplier();
    const m = await material(20);
    const ret = await (await A.owner.post('/api/purchases', { data: { supplierId: s, isReturn: true, items: [{ materialId: m, qty: 5, unitPrice: 1 }] } })).json();
    expect(await materialStock(m)).toBe(15);

    const put = await A.owner.put(`/api/purchases/${ret.id}`, { data: { items: [{ materialId: m, qty: 8, unitPrice: 1 }] } });
    expect(put.status(), await put.text()).toBe(200);
    expect(await materialStock(m)).toBe(12);
    expect((await prisma.purchase.findUnique({ where: { id: ret.id } }))!.total).toBe(8);

    expect((await A.owner.delete(`/api/purchases/${ret.id}`)).status()).toBe(200);
    expect(await materialStock(m)).toBe(20);
  });

  test('fasoncu deposundan iade; stok eksiye düşebilir ve uyarı döner', async () => {
    const s = await supplier();
    const m = await material(2);
    const sub = await (await A.owner.post('/api/subcontractors', { data: { name: uniq('Fasoncu') } })).json();
    await A.owner.post('/api/purchases', { data: { supplierId: s, items: [{ materialId: m, subcontractorId: sub.id, qty: 10, unitPrice: 1 }] } });
    await A.owner.post('/api/purchases', { data: { supplierId: s, isReturn: true, items: [{ materialId: m, subcontractorId: sub.id, qty: 3, unitPrice: 1 }] } });
    expect((await prisma.subcontractorStock.findFirst({ where: { subcontractorId: sub.id, materialId: m } }))!.quantity).toBe(7);

    const r = await (await A.owner.post('/api/purchases', { data: { supplierId: s, isReturn: true, items: [{ materialId: m, qty: 5, unitPrice: 1 }] } })).json();
    expect(await materialStock(m)).toBe(-3);
    expect(r.stockWarnings.map((w: any) => w.id)).toContain(m);
  });

  test('iade kalemsiz olamaz; başka firmanın hammaddesiyle iade reddedilir', async () => {
    const s = await supplier();
    expect((await A.owner.post('/api/purchases', { data: { supplierId: s, isReturn: true, total: 50 } })).status()).toBe(400);
    const foreignMat = await (await B.owner.post('/api/materials', { data: { name: uniq('Yabancı'), pricePerKg: 1, currency: 'USD' } })).json();
    const r = await A.owner.post('/api/purchases', { data: { supplierId: s, isReturn: true, items: [{ materialId: foreignMat.id, qty: 1, unitPrice: 1 }] } });
    expect([400, 403, 404]).toContain(r.status());
  });
});
