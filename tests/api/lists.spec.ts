import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Liste sayfalaması ve ana sayfa toplamları (büyük veride sayfa açılmama sorununa karşı).

let A: { companyId: string; owner: APIRequestContext };
const ids: { try: string; usd: string } = { try: '', usd: '' };

test.beforeAll(async () => {
  A = await createCompany('liste');
  const mk = async (currency: string) =>
    (await prisma.customer.create({ data: { companyId: A.companyId, name: `Liste ${currency} ${RUN}`, currency } })).id;
  ids.try = await mk('TRY');
  ids.usd = await mk('USD');
  // 120 fatura: 90 TRY satış, 20 USD satış, 10 TRY iade
  const rows = Array.from({ length: 120 }, (_, i) => {
    const isUsd = i >= 90 && i < 110;
    const isReturn = i >= 110;
    return {
      companyId: A.companyId,
      customerId: isUsd ? ids.usd : ids.try,
      invoiceNo: `${isReturn ? 'IAD' : 'FTR'}-LST-${String(i).padStart(4, '0')}`,
      date: new Date(Date.UTC(2026, 0, 1 + (i % 28))),
      currency: isUsd ? 'USD' : 'TRY',
      subtotal: 100, vatRate: 0, vatAmount: 0, total: 100,
      isReturn,
    };
  });
  await prisma.invoice.createMany({ data: rows });
  await prisma.payment.createMany({
    data: [
      { companyId: A.companyId, customerId: ids.try, amount: 500, currency: 'TRY', type: 'RECEIVED', method: 'Nakit', date: new Date() },
      { companyId: A.companyId, customerId: ids.usd, amount: 300, currency: 'USD', type: 'RECEIVED', method: 'Nakit', date: new Date() },
    ],
  });
  await prisma.company.update({ where: { id: A.companyId }, data: { usdToTry: 40, eurToTry: 45 } });
});

test.afterAll(async () => { await cleanup(); });

test('fatura listesi sayfalı döner', async () => {
  const p1 = await (await A.owner.get('/api/invoices?page=1&limit=50')).json();
  expect(p1).toMatchObject({ total: 120, page: 1, limit: 50, totalPages: 3 });
  expect(p1.items).toHaveLength(50);
  const p3 = await (await A.owner.get('/api/invoices?page=3&limit=50')).json();
  expect(p3.items).toHaveLength(20);
  const all = new Set([...p1.items, ...p3.items].map((i: any) => i.id));
  expect(all.size).toBe(70);
});

test('sayfa boyutu üst sınırı 200', async () => {
  const r = await (await A.owner.get('/api/invoices?page=1&limit=100000')).json();
  expect(r.limit).toBe(200);
  expect(r.items.length).toBeLessThanOrEqual(200);
});

test('fatura listesi arama, müşteri ve tür filtreleri sunucuda çalışır', async () => {
  const byNo = await (await A.owner.get('/api/invoices?page=1&q=LST-0042')).json();
  expect(byNo.items.map((i: any) => i.invoiceNo)).toEqual(['FTR-LST-0042']);
  const byCustomer = await (await A.owner.get(`/api/invoices?page=1&customerId=${ids.usd}`)).json();
  expect(byCustomer.total).toBe(20);
  const returns = await (await A.owner.get('/api/invoices?page=1&type=return')).json();
  expect(returns.total).toBe(10);
});

test('sayfasız eski kullanım dizi döner (en fazla 1000 kayıt)', async () => {
  const r = await (await A.owner.get('/api/invoices')).json();
  expect(Array.isArray(r)).toBe(true);
  expect(r.length).toBe(120);
});

test('ödeme listesi toplamları para birimine göre ayrı verir', async () => {
  const r = await (await A.owner.get('/api/payments?page=1&limit=50')).json();
  expect(r.total).toBe(2);
  expect(r.totals).toEqual(expect.arrayContaining([
    { type: 'RECEIVED', currency: 'TRY', amount: 500 },
    { type: 'RECEIVED', currency: 'USD', amount: 300 },
  ]));
});

test('ana sayfa toplam alacağı müşteri bakiyeleriyle aynı (TL)', async () => {
  const d = await (await A.owner.get('/api/dashboard')).json();
  // TRY müşteri: 90 satış − 10 iade = 8000 − 500 tahsilat = 7500
  // USD müşteri: 20 × 100 = 2000 − 300 = 1700 USD × 40 = 68000
  expect(d.totalReceivables).toBe(7500 + 68000);
  const list = await (await A.owner.get(`/api/customers?search=${encodeURIComponent(RUN)}`)).json();
  const balances = Object.fromEntries((list.customers ?? []).map((c: any) => [c.id, c.balance]));
  expect(balances[ids.try]).toBe(7500);
  expect(balances[ids.usd]).toBe(1700);
});

test('sipariş listesi toplam sayıyı başlıkta döner', async () => {
  const r = await A.owner.get('/api/orders');
  expect(r.headers()['x-total-count']).toBe('0');
});
