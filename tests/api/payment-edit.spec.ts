import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Tahsilat / ödeme düzenleme: kasa bakiyesi ve fatura ödenen tutarı eski kayıttan geri alınıp yenisiyle güncellenir.
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

test('tutar ve kasa değişince bakiyeler, fatura ödenen tutarı ve durumu doğru güncellenir', async () => {
  const inv = await prisma.invoice.create({ data: { companyId: A.companyId, customerId: cust, invoiceNo: `PE-${RUN}`, date: new Date(), subtotal: 100, total: 100, currency: 'TRY' } });
  const p = await (await A.owner.post('/api/payments', { data: { customerId: cust, invoiceId: inv.id, accountId: kasa1, amount: 100, currency: 'TRY', method: 'Nakit' } })).json();
  expect([await bal(kasa1), (await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status]).toEqual([100, 'PAID']);

  const r = await A.owner.put(`/api/payments/${p.id}`, { data: { amount: '40', accountId: kasa2, date: '2026-11-20', notes: 'düzeltildi' } });
  expect(r.status(), await r.text()).toBe(200);
  expect([await bal(kasa1), await bal(kasa2)]).toEqual([0, 40]);
  const i2 = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  expect([i2.paidAmount, i2.status]).toEqual([40, 'PARTIAL']);
  const saved = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  expect([saved.amount, saved.notes, saved.accountId]).toEqual([40, 'düzeltildi', kasa2]);

  // Fazla ödeme onay ister
  const over = await A.owner.put(`/api/payments/${p.id}`, { data: { amount: 150 } });
  expect(over.status()).toBe(409);
  expect((await over.json()).code).toBe('OVERPAYMENT');
  expect((await A.owner.put(`/api/payments/${p.id}`, { data: { amount: 150, allowOverpayment: true } })).status()).toBe(200);
  expect(await bal(kasa2)).toBe(150);
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
