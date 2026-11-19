import { test, expect, APIRequestContext } from '@playwright/test';
import { RUN, createCompany, createPortalCustomer, loggedIn, cleanup } from '../security/helpers';

// Portal müşterisi kendi ekstre linkini yalnızca firma link oluşturduysa görür.

let A: { companyId: string; owner: APIRequestContext };
let portal: APIRequestContext;
let customerId: string;
let otherId: string;

test.beforeAll(async () => {
  A = await createCompany('portal-ekstre');
  const mk = async (n: string) => (await (await A.owner.post('/api/customers', { data: { name: `${n} ${RUN}`, currency: 'TRY' } })).json()).id as string;
  customerId = await mk('Portal Ekstre Müşteri');
  otherId = await mk('Portal Diğer Müşteri');
  portal = await loggedIn(await createPortalCustomer(customerId, 'portal-ekstre'), undefined, 'portal-credentials');
});
test.afterAll(async () => { await portal.dispose(); await cleanup(); });

const myLink = async () => {
  const r = await portal.get('/api/portal/me/statement-link');
  expect(r.status()).toBe(200);
  return (await r.json()).url as string | null;
};

test('link yoksa boş; firma oluşturunca görünür; başka müşterinin linki görünmez; kapatınca boş', async () => {
  expect(await myLink()).toBeNull();

  await A.owner.post('/api/statement-links', { data: { customerId: otherId } });
  expect(await myLink()).toBeNull();

  const created = (await (await A.owner.post('/api/statement-links', { data: { customerId } })).json()).link.url;
  expect(await myLink()).toBe(created);

  const renewed = (await (await A.owner.post('/api/statement-links', { data: { customerId, regenerate: true } })).json()).link.url;
  expect(await myLink()).toBe(renewed);

  await A.owner.delete(`/api/statement-links?customerId=${customerId}`);
  expect(await myLink()).toBeNull();
});

test('firma kullanıcısı bu uç noktayı kullanamaz', async () => {
  expect([401, 403]).toContain((await A.owner.get('/api/portal/me/statement-link')).status());
});
