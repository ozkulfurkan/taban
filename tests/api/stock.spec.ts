import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, createUser, loggedIn, cleanup } from '../security/helpers';

// Ürün ve hammadde stokunun elle düzeltilmesi: hareket kaydı, ekstre, roller ve firma ayrımı.

let A: { companyId: string; owner: APIRequestContext };
let B: { companyId: string; owner: APIRequestContext };
let viewer: APIRequestContext;

test.beforeAll(async () => {
  A = await createCompany('stok');
  B = await createCompany('stok-b');
  viewer = await loggedIn(await createUser(A.companyId, 'stok-viewer', 'VIEWER'));
});
test.afterAll(async () => { await viewer.dispose(); await cleanup(); });

async function product(owner: APIRequestContext, stock = 10) {
  const r = await owner.post('/api/products', { data: { name: `Stok Ürün ${RUN} ${Math.random().toString(36).slice(2, 6)}`, unit: 'çift', stock } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

test('ürün stok girişi/çıkışı hareket olarak kaydedilir ve ekstrede görünür', async () => {
  const p = await product(A.owner, 10);
  const add = await A.owner.post(`/api/products/${p.id}/stok`, { data: { delta: 24, notes: 'Sayım fazlası' } });
  expect(add.status()).toBe(200);
  expect((await add.json()).stock).toBe(34);
  const sub = await A.owner.post(`/api/products/${p.id}/stok`, { data: { delta: -4 } });
  expect((await sub.json()).stock).toBe(30);

  const adjs = await prisma.productStockAdjustment.findMany({ where: { productId: p.id }, orderBy: { createdAt: 'asc' } });
  expect(adjs.map(a => [a.type, a.delta, a.notes])).toEqual([['manuel_ekle', 24, 'Sayım fazlası'], ['manuel_cikar', -4, null]]);

  const ek = await (await A.owner.get(`/api/products/${p.id}/ekstre`)).json();
  const parties = ek.entries.filter((e: any) => e.type === 'stok_ayar').map((e: any) => [e.party, e.qty]);
  expect(parties).toEqual(expect.arrayContaining([['Manuel Ekleme', 24], ['Manuel Çıkarma', -4]]));
});

test('geçersiz delta 400; görüntüleyici 403; başka firmanın ürünü 404', async () => {
  const p = await product(A.owner, 5);
  for (const delta of [0, 'abc', null]) {
    expect((await A.owner.post(`/api/products/${p.id}/stok`, { data: { delta } })).status()).toBe(400);
  }
  expect((await viewer.post(`/api/products/${p.id}/stok`, { data: { delta: 1 } })).status()).toBe(403);
  expect((await B.owner.post(`/api/products/${p.id}/stok`, { data: { delta: 1 } })).status()).toBe(404);
  expect((await prisma.product.findUnique({ where: { id: p.id } }))!.stock).toBe(5);
  expect(await prisma.productStockAdjustment.count({ where: { productId: p.id } })).toBe(0);
});
