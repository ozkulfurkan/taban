import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Çek portföyü toplu işlemleri: bankaya ver, tedarikçiye öde (döviz karşılığıyla), tahsil et.

let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };

test.beforeAll(async () => {
  A = await createCompany('cek');
  B = await createCompany('cek-b');
});
test.afterAll(async () => { await cleanup(); });

const uniq = (p: string) => `${p} ${RUN} ${Math.random().toString(36).slice(2, 7)}`;
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function cek(owner: APIRequestContext, tutar: number, currency = 'TRY', vadeOffset = 30, seriNo = uniq('S')) {
  const r = await owner.post('/api/cek', { data: { borclu: uniq('Borçlu'), tutar, currency, vadesi: day(vadeOffset), seriNo } });
  expect(r.status(), await r.text()).toBe(201);
  return r.json();
}
async function account(owner: APIRequestContext, currency = 'TRY', type = 'Banka') {
  const r = await owner.post('/api/accounts', { data: { name: uniq('Hesap'), type, currency, balance: 0 } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
const bulk = (owner: APIRequestContext, data: any) => owner.post('/api/cek/bulk', { data });

test('bankaya ver: durum ve banka hesabı yazılır; portföyde olmayan çek reddedilir', async () => {
  const acc = await account(A.owner);
  const c1 = await cek(A.owner, 1000);
  const c2 = await cek(A.owner, 500);
  const r = await bulk(A.owner, { action: 'bank', ids: [c1.id, c2.id], accountId: acc.id, date: day(0) });
  expect(r.status(), await r.text()).toBe(200);
  const saved = await prisma.cek.findMany({ where: { id: { in: [c1.id, c2.id] } } });
  expect(saved.every(c => c.durum === 'BANKAYA_VERILDI' && c.bankAccountId === acc.id)).toBe(true);
  expect((await prisma.account.findUnique({ where: { id: acc.id } }))!.balance).toBe(0); // para henüz geçmez

  const again = await bulk(A.owner, { action: 'bank', ids: [c1.id], accountId: acc.id });
  expect(again.status()).toBe(400);
});

test('tahsil et: hesap bakiyesi artar; farklı dövizdeki hesap reddedilir', async () => {
  const acc = await account(A.owner, 'TRY');
  const usdAcc = await account(A.owner, 'USD');
  const c1 = await cek(A.owner, 1200);
  const c2 = await cek(A.owner, 300);
  await bulk(A.owner, { action: 'bank', ids: [c1.id, c2.id], accountId: acc.id });

  expect((await bulk(A.owner, { action: 'collect', ids: [c1.id, c2.id], accountId: usdAcc.id })).status()).toBe(400);
  const r = await bulk(A.owner, { action: 'collect', ids: [c1.id, c2.id], accountId: acc.id, date: day(0) });
  expect(r.status(), await r.text()).toBe(200);
  expect((await prisma.account.findUnique({ where: { id: acc.id } }))!.balance).toBe(1500);
  const saved = await prisma.cek.findMany({ where: { id: { in: [c1.id, c2.id] } } });
  expect(saved.every(c => c.durum === 'ODENDI' && c.paymentId)).toBe(true);
});

test('tedarikçiye öde: USD karşılıkla ödeme, bakiye düşer, geri alma tam o ödemeyi siler', async () => {
  const sup = await (await A.owner.post('/api/suppliers', { data: { name: uniq('Tedarikçi'), currency: 'USD' } })).json();
  // Aynı tutar ve aynı seri no'lu iki çek: eski tahmin yöntemi yanlış ödemeyi silebiliyordu
  const seri = uniq('AYNI');
  const c1 = await cek(A.owner, 3400, 'TRY', 30, seri);
  const c2 = await cek(A.owner, 3400, 'TRY', 40, seri);
  const r = await bulk(A.owner, {
    action: 'supplier', supplierId: sup.id, date: day(0), note: 'toplu',
    ids: [c1.id, c2.id], items: [{ id: c1.id, amount: 100 }, { id: c2.id, amount: '99,50' }],
  });
  expect(r.status(), await r.text()).toBe(200);

  const pays = await prisma.payment.findMany({ where: { supplierId: sup.id }, orderBy: { amount: 'desc' } });
  expect(pays.map(p => [p.amount, p.currency, p.originalAmount, p.originalCurrency])).toEqual([[100, 'USD', 3400, 'TRY'], [99.5, 'USD', 3400, 'TRY']]);
  expect(pays[0].exchangeRate).toBeCloseTo(100 / 3400, 6);
  const detail = await (await A.owner.get(`/api/suppliers/${sup.id}`)).json();
  expect(detail.balance).toBe(-199.5);

  const c2saved = await prisma.cek.findUnique({ where: { id: c2.id } });
  expect(c2saved!.durum).toBe('TEDARIKCI_VERILDI');
  await A.owner.patch(`/api/cek/${c2.id}`, { data: { durum: 'PORTFOY', removeSupplierPayment: true } });
  const left = await prisma.payment.findMany({ where: { supplierId: sup.id } });
  // Sadece c2'nin ödemesi silindi; aynı tutar ve seri no'lu c1'in ödemesi duruyor
  expect(left).toHaveLength(1);
  expect(left[0].id).not.toBe(c2saved!.paymentId);
  expect(left[0].id).toBe((await prisma.cek.findUnique({ where: { id: c1.id } }))!.paymentId);
  expect((await prisma.cek.findUnique({ where: { id: c2.id } }))!.supplierId).toBeNull();
});

test('tedarikçiye öde: döviz karşılığı eksikse hiçbir şey değişmez', async () => {
  const sup = await (await A.owner.post('/api/suppliers', { data: { name: uniq('Tedarikçi'), currency: 'EUR' } })).json();
  const c1 = await cek(A.owner, 1000);
  const c2 = await cek(A.owner, 2000);
  const r = await bulk(A.owner, { action: 'supplier', supplierId: sup.id, ids: [c1.id, c2.id], items: [{ id: c1.id, amount: 30 }] });
  expect(r.status()).toBe(400);
  expect(await prisma.payment.count({ where: { supplierId: sup.id } })).toBe(0);
  expect((await prisma.cek.findUnique({ where: { id: c1.id } }))!.durum).toBe('PORTFOY');
});

test('firma ayrımı: başka firmanın çeki, hesabı ya da tedarikçisi kullanılamaz', async () => {
  const mine = await cek(A.owner, 100);
  const theirs = await cek(B.owner, 100);
  const theirAcc = await account(B.owner);
  const myAcc = await account(A.owner);
  expect([400, 403, 404]).toContain((await bulk(A.owner, { action: 'bank', ids: [mine.id, theirs.id], accountId: myAcc.id })).status());
  expect([400, 403, 404]).toContain((await bulk(A.owner, { action: 'bank', ids: [mine.id], accountId: theirAcc.id })).status());
  expect((await prisma.cek.findUnique({ where: { id: mine.id } }))!.durum).toBe('PORTFOY');
  expect((await prisma.cek.findUnique({ where: { id: theirs.id } }))!.durum).toBe('PORTFOY');
});

test('liste: döviz bazında toplamlar ve vade filtresi', async () => {
  const C = await createCompany('cek-liste');
  await cek(C.owner, 1000, 'TRY', -5);
  await cek(C.owner, 3000, 'TRY', 20);
  await cek(C.owner, 200, 'USD', 3);
  const all = await (await C.owner.get('/api/cek')).json();
  expect(all.totals.map((x: any) => [x.currency, x.count, x.total])).toEqual([['TRY', 2, 4000], ['USD', 1, 200]]);
  const overdue = await (await C.owner.get('/api/cek?vade=overdue')).json();
  expect(overdue.cekler).toHaveLength(1);
  expect(overdue.cekler[0].tutar).toBe(1000);
  const week = await (await C.owner.get('/api/cek?vade=week')).json();
  expect(week.cekler.map((c: any) => c.currency)).toEqual(['USD']);
});
