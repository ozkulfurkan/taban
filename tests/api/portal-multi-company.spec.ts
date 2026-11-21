import { test, expect } from '@playwright/test';
import {
  prisma, RUN, createCompany, createPortalCustomer, login, newClient, cleanup,
} from '../security/helpers';

// Aynı e-posta birden fazla firmanın portal kullanıcısı olabilir (firma + e-posta tekil).
// Girişte şifreye uyan hesaplar arasından firma seçilir; her hesap yalnızca kendi firmasını görür.

const uid = () => Math.random().toString(36).slice(2, 7);

test.afterAll(async () => { await cleanup(); });

test('iki firma aynı e-postayla portal hesabı açabilir; aynı firmada ikinci hesap reddedilir', async () => {
  const A = await createCompany('coklu-a');
  const B = await createCompany('coklu-b');
  const email = `sec-coklu-${uid()}-${RUN}@test.local`;
  const ca = await prisma.customer.create({ data: { companyId: A.companyId, name: `Çoklu A ${RUN}` } });
  const ca2 = await prisma.customer.create({ data: { companyId: A.companyId, name: `Çoklu A2 ${RUN}` } });
  const cb = await prisma.customer.create({ data: { companyId: B.companyId, name: `Çoklu B ${RUN}` } });
  const reg = (owner: any, customerId: string, mail = email) => owner.post('/api/portal/auth/register', { data: { customerId, email: mail, password: 'Portal123' } });

  expect((await reg(A.owner, ca.id)).status()).toBe(201);
  expect((await reg(B.owner, cb.id)).status()).toBe(201);
  // Aynı firmada aynı e-posta (büyük harf farkı dahil) ikinci kez açılamaz
  expect((await reg(A.owner, ca2.id, email.toUpperCase())).status()).toBe(400);
  const rows = await prisma.portalCustomer.findMany({ where: { email } });
  expect(rows.map(r => r.companyId).sort()).toEqual([A.companyId, B.companyId].sort());
});

test('şifreler aynıysa firma seçilir; seçilen firmanın kataloğu görünür, diğeri görünmez', async () => {
  const A = await createCompany('secim-a');
  const B = await createCompany('secim-b');
  const email = `sec-secim-${uid()}-${RUN}@test.local`;
  const ca = await prisma.customer.create({ data: { companyId: A.companyId, name: `Seçim A ${RUN}` } });
  const cb = await prisma.customer.create({ data: { companyId: B.companyId, name: `Seçim B ${RUN}` } });
  await createPortalCustomer(ca.id, 'secim-a', email);
  await createPortalCustomer(cb.id, 'secim-b', email);
  const pa = await prisma.product.create({ data: { companyId: A.companyId, name: `A Ürün ${RUN}`, portalVisible: true } as any });
  const pb = await prisma.product.create({ data: { companyId: B.companyId, name: `B Ürün ${RUN}`, portalVisible: true } as any });
  const accA = await prisma.portalCustomer.findFirstOrThrow({ where: { email, companyId: A.companyId } });
  const accB = await prisma.portalCustomer.findFirstOrThrow({ where: { email, companyId: B.companyId } });

  // Web: seçim olmadan giriş CHOOSE_ACCOUNT ile reddedilir
  const web = await newClient();
  const first = await login(web, email, 'Guvenlik123', 'portal-credentials');
  expect(first.error).toBe('CHOOSE_ACCOUNT');
  expect(first.session?.user).toBeFalsy();

  // Hesap listesi: iki firma; yanlış şifrede bilgi yok
  const list = await web.post('/api/portal/auth/accounts', { data: { email, password: 'Guvenlik123' } });
  expect(list.status()).toBe(200);
  const accounts = (await list.json()).accounts;
  expect(accounts.map((a: any) => a.id).sort()).toEqual([accA.id, accB.id].sort());
  expect(accounts.find((a: any) => a.id === accB.id).companyName).toContain('secim-b');
  expect((await web.post('/api/portal/auth/accounts', { data: { email, password: 'yanlis1' } })).status()).toBe(401);

  // B seçilir: yalnızca B'nin kataloğu
  const csrf = await (await web.get('/api/auth/csrf')).json();
  await web.post('/api/auth/callback/portal-credentials', { form: { email, password: 'Guvenlik123', accountId: accB.id, csrfToken: csrf.csrfToken, json: 'true' }, maxRedirects: 0 });
  const session = await (await web.get('/api/auth/session')).json();
  expect(session?.user?.id).toBe(accB.id);
  const cat = await (await web.get('/api/portal/me/catalog')).json();
  const ids = cat.map((p: any) => p.id);
  expect(ids).toContain(pb.id);
  expect(ids).not.toContain(pa.id);

  // Mobil: 409 + liste, sonra accountId ile A
  const anon = await newClient();
  const m = await anon.post('/api/mobile/auth/login', { data: { email, password: 'Guvenlik123', kind: 'portal' } });
  expect(m.status()).toBe(409);
  const mb = await m.json();
  expect(mb.code).toBe('CHOOSE_ACCOUNT');
  expect(mb.accounts).toHaveLength(2);
  const ok = await anon.post('/api/mobile/auth/login', { data: { email, password: 'Guvenlik123', kind: 'portal', accountId: accA.id } });
  expect(ok.status(), await ok.text()).toBe(200);
  const me = await (await anon.get('/api/portal/me/catalog', { headers: { Authorization: `Bearer ${(await ok.json()).token}` } })).json();
  expect(me.map((p: any) => p.id)).toContain(pa.id);
  expect(me.map((p: any) => p.id)).not.toContain(pb.id);

  // Şifresi uymayan / başka e-postanın hesap kimliği verilemez
  const other = await anon.post('/api/mobile/auth/login', { data: { email, password: 'Guvenlik123', kind: 'portal', accountId: 'cl_yok' } });
  expect(other.status()).toBe(401);
  await Promise.all([web.dispose(), anon.dispose()]);
});

test('şifreler farklıysa girilen şifrenin uyduğu hesaba doğrudan girilir', async () => {
  const A = await createCompany('fark-a');
  const B = await createCompany('fark-b');
  const email = `sec-fark-${uid()}-${RUN}@test.local`;
  const ca = await prisma.customer.create({ data: { companyId: A.companyId, name: `Fark A ${RUN}` } });
  const cb = await prisma.customer.create({ data: { companyId: B.companyId, name: `Fark B ${RUN}` } });
  await createPortalCustomer(ca.id, 'fark-a', email, 'SifreA123');
  await createPortalCustomer(cb.id, 'fark-b', email, 'SifreB123');
  const accB = await prisma.portalCustomer.findFirstOrThrow({ where: { email, companyId: B.companyId } });

  const web = await newClient();
  const r = await login(web, email, 'SifreB123', 'portal-credentials');
  expect(r.error).toBeFalsy();
  expect(r.session?.user?.id).toBe(accB.id);
  await web.dispose();
});
