import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Mükerrer kayıt koruması (lib/request-dedup.ts): çift tıklama, iki sekme ya da mobil ağ tekrarıyla aynı anda
// gelen aynı içerikli kayıt istekleri tek kayıt açar; hatalı istek iz bırakmaz; ayrı içerik ve başka firma etkilenmez.
let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let cust: string; let sup: string; let mat: string;

test.beforeAll(async () => {
  A = await createCompany('dup-a');
  B = await createCompany('dup-b');
  cust = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri ${RUN}`, currency: 'TRY' } })).id;
  sup = (await prisma.supplier.create({ data: { companyId: A.companyId, name: `Tedarikçi ${RUN}`, currency: 'TRY' } })).id;
  mat = (await prisma.material.create({ data: { companyId: A.companyId, name: `HM ${RUN}`, pricePerKg: 1 } })).id;
});
test.afterAll(async () => { await cleanup(); });

const cases = () => [
  ['satış', '/api/invoices', { customerId: cust, vatRate: 0, items: [{ description: 'Taban', quantity: 3, unitPrice: 7 }] }, () => prisma.invoice.count({ where: { companyId: A.companyId, isReturn: false } })],
  ['satış iadesi', '/api/invoices', { customerId: cust, isReturn: true, vatRate: 0, items: [{ description: 'İade', quantity: 1, unitPrice: 7 }] }, () => prisma.invoice.count({ where: { companyId: A.companyId, isReturn: true } })],
  ['alış', '/api/purchases', { supplierId: sup, items: [{ materialId: mat, qty: 2, unitPrice: 3 }] }, () => prisma.purchase.count({ where: { companyId: A.companyId, isReturn: false } })],
  ['alış iadesi', '/api/purchases', { supplierId: sup, isReturn: true, items: [{ materialId: mat, qty: 1, unitPrice: 3 }] }, () => prisma.purchase.count({ where: { companyId: A.companyId, isReturn: true } })],
  ['tahsilat', '/api/payments', { type: 'RECEIVED', customerId: cust, amount: 11, currency: 'TRY', method: 'Nakit' }, () => prisma.payment.count({ where: { companyId: A.companyId, customerId: cust } })],
  ['ödeme', '/api/payments', { type: 'PAID', supplierId: sup, amount: 12, currency: 'TRY', method: 'Nakit' }, () => prisma.payment.count({ where: { companyId: A.companyId, supplierId: sup } })],
  ['çek', '/api/cek', { customerId: cust, borclu: 'Borçlu', islemTarihi: '2026-11-25', vadesi: '2027-01-15', tutar: 500, currency: 'TRY' }, () => prisma.cek.count({ where: { companyId: A.companyId } })],
] as const;

test('aynı anda gelen 3 aynı kayıt isteği tek kayıt açar; diğerleri 409', async () => {
  for (const [name, url, data, count] of cases()) {
    const before = await count();
    const res = await Promise.all([0, 1, 2].map(() => A.owner.post(url, { data })));
    const codes = res.map(r => r.status()).sort();
    expect(codes.filter(c => c === 409), `${name}: ${codes}`).toHaveLength(2);
    expect(await count() - before, name).toBe(1);
    const dup = res.find(r => r.status() === 409)!;
    expect((await dup.json()).duplicate).toBe(true);
  }
});

test('içerik farklıysa (ör. toplu çekte sıra no) ve başka firmada engellenmez', async () => {
  const body = { customerId: cust, borclu: 'İkiz', islemTarihi: '2026-11-25', vadesi: '2027-02-01', tutar: 750, currency: 'TRY' };
  const twins = await Promise.all([0, 1].map(lineNo => A.owner.post('/api/cek', { data: { ...body, lineNo } })));
  expect(twins.map(r => r.status())).toEqual([201, 201]);
  // Aynı gövde başka firmada: o firmanın müşterisi değil → kendi kuralıyla reddedilir, 409 değil
  expect((await B.owner.post('/api/cek', { data: body })).status()).not.toBe(409);
});

test('hatalı istek iz bırakmaz: düzeltip hemen yeniden gönderilebilir', async () => {
  const bad = { customerId: cust, amount: -5 };
  expect((await A.owner.post('/api/payments', { data: bad })).status()).toBe(400);
  expect((await A.owner.post('/api/payments', { data: bad })).status()).toBe(400);
});
