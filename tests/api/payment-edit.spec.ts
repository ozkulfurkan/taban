import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Tahsilat / ödeme düzenleme: kasa bakiyesi eski kayıttan geri alınıp yenisiyle güncellenir; kayıtlar faturaya bağlanmaz.
let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let viewer: APIRequestContext;
let cust: string; let kasa1: string; let kasa2: string;

test.beforeAll(async () => {
  A = await createCompany('pay-edit-a');
  B = await createCompany('pay-edit-b');
  cust = (await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri ${RUN}`, currency: 'TRY' } })).id;
  kasa1 = (await prisma.account.create({ data: { companyId: A.companyId, name: `Kasa1 ${RUN}`, currency: 'TRY', balance: 0 } })).id;
  kasa2 = (await prisma.account.create({ data: { companyId: A.companyId, name: `Kasa2 ${RUN}`, currency: 'TRY', balance: 0 } })).id;
  viewer = await loggedIn(await createUser(A.companyId, 'pay-viewer', 'VIEWER'));
});
test.afterAll(async () => { await viewer.dispose(); await cleanup(); });

const bal = async (id: string) => (await prisma.account.findUniqueOrThrow({ where: { id } })).balance;

test('tutar ve kasa değişince kasa bakiyeleri doğru güncellenir; fazla tutar onay istemez', async () => {
  const p = await (await A.owner.post('/api/payments', { data: { customerId: cust, accountId: kasa1, amount: 100, currency: 'TRY', method: 'Nakit' } })).json();
  expect(await bal(kasa1)).toBe(100);
  const r = await A.owner.put(`/api/payments/${p.id}`, { data: { amount: '40', accountId: kasa2, date: '2026-11-20', notes: 'düzeltildi' } });
  expect(r.status(), await r.text()).toBe(200);
  expect([await bal(kasa1), await bal(kasa2)]).toEqual([0, 40]);
  const saved = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  expect([saved.amount, saved.notes, saved.accountId]).toEqual([40, 'düzeltildi', kasa2]);
  expect((await A.owner.put(`/api/payments/${p.id}`, { data: { amount: 150 } })).status()).toBe(200);
  expect(await bal(kasa2)).toBe(150);
  expect((await A.owner.delete(`/api/payments/${p.id}`)).status()).toBe(200);
  expect(await bal(kasa2)).toBe(0);
});

test('çek ve transfer kaydında yalnızca tarih ve açıklama değişir; yetki ve firma ayrımı', async () => {
  const p = await (await A.owner.post('/api/payments', { data: { customerId: cust, accountId: kasa1, amount: 25, currency: 'TRY', method: 'Nakit' } })).json();
  await prisma.payment.update({ where: { id: p.id }, data: { method: 'Çek' } });
  expect((await A.owner.put(`/api/payments/${p.id}`, { data: { amount: 30 } })).status()).toBe(400);
  expect((await A.owner.put(`/api/payments/${p.id}`, { data: { notes: 'çek notu', date: '2026-11-21' } })).status()).toBe(200);
  expect((await B.owner.put(`/api/payments/${p.id}`, { data: { notes: 'x' } })).status()).toBe(404);
  expect((await viewer.put(`/api/payments/${p.id}`, { data: { notes: 'x' } })).status()).toBe(403);
  expect((await A.owner.put(`/api/payments/${p.id}`, { data: { amount: -5 } })).status()).toBe(400);
});

test('satış veya alış silinince tahsilat ve ödeme silinmez; kasa değişmez, cari bakiyede kalır', async () => {
  const before = await bal(kasa1);
  const inv = await (await A.owner.post('/api/invoices', { data: { customerId: cust, date: new Date().toISOString(), vatRate: 0, currency: 'TRY', items: [{ description: `Silinecek ${RUN}`, quantity: 1, unitPrice: 300 }] } })).json();
  const p = await (await A.owner.post('/api/payments', { data: { invoiceId: inv.id, accountId: kasa1, amount: 120, currency: 'TRY', method: 'Nakit' } })).json();
  expect(p.invoiceId).toBeNull();
  // Eski kayıtlardaki bağ: fatura silinince kopar, tahsilat kalır
  await prisma.payment.update({ where: { id: p.id }, data: { invoiceId: inv.id } });
  const balBefore = (await (await A.owner.get(`/api/customers/${cust}`)).json()).balance;
  expect((await A.owner.delete(`/api/invoices/${inv.id}`)).status()).toBe(200);
  expect(await bal(kasa1)).toBe(before + 120);
  const kept = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  expect([kept.amount, kept.invoiceId]).toEqual([120, null]);
  expect((await (await A.owner.get(`/api/customers/${cust}`)).json()).balance).toBe(balBefore - 300);
  await A.owner.delete(`/api/payments/${p.id}`);

  // Alış tarafı
  const sup = (await prisma.supplier.create({ data: { companyId: A.companyId, name: `Tedarikçi ${RUN}`, currency: 'TRY' } })).id;
  const pur = await prisma.purchase.create({ data: { companyId: A.companyId, supplierId: sup, invoiceNo: `AL-${RUN}`, date: new Date(), total: 500, currency: 'TRY' } });
  const op = await (await A.owner.post('/api/payments', { data: { purchaseId: pur.id, accountId: kasa1, amount: 200, currency: 'TRY', method: 'Nakit' } })).json();
  expect([op.purchaseId, op.supplierId, op.type]).toEqual([null, sup, 'PAID']);
  expect((await (await A.owner.get(`/api/purchases/${pur.id}`)).json()).supplierBalance).toBe(300);
  await prisma.payment.update({ where: { id: op.id }, data: { purchaseId: pur.id } });
  const k0 = await bal(kasa1);
  expect((await A.owner.delete(`/api/purchases/${pur.id}`)).status()).toBe(200);
  expect(await bal(kasa1)).toBe(k0);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: op.id } })).purchaseId).toBeNull();
  expect((await (await A.owner.get(`/api/suppliers/${sup}`)).json()).balance).toBe(-200); // tedarikçiden alacaklıyız
  // Başka firmanın faturasıyla tahsilat girilemez
  expect((await B.owner.post('/api/payments', { data: { invoiceId: (await prisma.invoice.create({ data: { companyId: A.companyId, customerId: cust, invoiceNo: `X-${RUN}`, date: new Date(), total: 1 } })).id, amount: 1 } })).status()).toBe(404);
});
