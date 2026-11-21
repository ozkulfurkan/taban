import { test, expect } from '@playwright/test';
import { prisma, RUN, PASSWORD, createCompany, createUser, createPortalCustomer, loggedIn, cleanup } from '../security/helpers';

// Mobil ürün listesi: seçilen ürünler tek seferde portalda gösterilir / gizlenir.
test.afterAll(async () => { await cleanup(); });

test('toplu portal görünürlüğü: düzenleyici açar/kapatır, görüntüleyici ve başka firma reddedilir, müşteri ataması korunur', async () => {
  const A = await createCompany('gorunur-a');
  const B = await createCompany('gorunur-b');
  const mk = (cid: string, n: string) => prisma.product.create({ data: { companyId: cid, name: `${n} ${RUN}`, portalVisible: false } as any });
  const p1 = await mk(A.companyId, 'Görünür 1'); const p2 = await mk(A.companyId, 'Görünür 2'); const pb = await mk(B.companyId, 'Yabancı');
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Görünür Müşteri ${RUN}` } });
  const portalEmail = await createPortalCustomer(cust.id, 'gorunur-p');
  const pc = await prisma.portalCustomer.findFirstOrThrow({ where: { email: portalEmail } });
  // p2 yalnızca bu müşteriye atanmış: toplu işlem atamayı silmemeli
  await prisma.productPortalCustomer.create({ data: { productId: p2.id, portalCustomerId: pc.id } });

  const editor = await loggedIn(await createUser(A.companyId, `gorunur-ed-${RUN}`, 'EDITOR'));
  const viewer = await loggedIn(await createUser(A.companyId, `gorunur-v-${RUN}`, 'VIEWER'));
  const set = (who: any, ids: string[], visible: boolean) => who.post('/api/products/portal-visibility', { data: { ids, visible } });

  expect((await set(viewer, [p1.id], true)).status()).toBe(403);
  expect((await set(editor, [p1.id, pb.id], true)).status()).toBe(404);
  expect((await set(editor, [], true)).status()).toBe(400);
  const ok = await set(editor, [p1.id, p2.id], true);
  expect(ok.status(), await ok.text()).toBe(200);
  expect((await ok.json()).updated).toBe(2);
  expect(await prisma.productPortalCustomer.count({ where: { productId: p2.id } })).toBe(1);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: pb.id } })).portalVisible).toBe(false);

  const portal = await loggedIn(portalEmail, PASSWORD, 'portal-credentials');
  let ids = (await (await portal.get('/api/portal/me/catalog')).json()).map((p: any) => p.id);
  expect(ids).toEqual(expect.arrayContaining([p1.id, p2.id]));

  expect((await set(editor, [p1.id], false)).status()).toBe(200);
  ids = (await (await portal.get('/api/portal/me/catalog')).json()).map((p: any) => p.id);
  expect(ids).not.toContain(p1.id);
  expect(ids).toContain(p2.id);
  await Promise.all([editor.dispose(), viewer.dispose(), portal.dispose()]);
});
