import { test, expect, APIRequestContext } from '@playwright/test';
import {
  prisma, PASSWORD, RUN, createCompany, createUser, createPortalCustomer,
  loggedIn, login, newClient, email, cleanup,
} from './helpers';

// Firmalar arası veri ayrımı, roller ve oturum güvenliği.
// 18.11.2026 test raporundaki açıkların geri gelmemesi için.

let A: { ownerEmail: string; companyId: string; owner: APIRequestContext };
let B: { ownerEmail: string; companyId: string; owner: APIRequestContext };
const ids: Record<string, string> = {};

test.beforeAll(async () => {
  A = await createCompany('a');
  B = await createCompany('b');
  const post = async (path: string, data: any) => {
    const r = await A.owner.post(path, { data });
    expect(r.status(), `${path}: ${await r.text()}`).toBeLessThan(300);
    return r.json();
  };
  ids.customer = (await post('/api/customers', { name: `Müşteri ${RUN}`, currency: 'TRY' })).id;
  ids.material = (await post('/api/materials', { name: `Hammadde ${RUN}`, pricePerKg: 4, currency: 'USD' })).id;
  ids.product = (await post('/api/products', { name: `Taban ${RUN}`, currency: 'USD' })).id;
  ids.category = (await post('/api/product-categories', { name: `Kategori ${RUN}` })).id;
  ids.account = (await post('/api/accounts', { name: `Kasa ${RUN}`, type: 'Kasa', currency: 'TRY' })).id;
  ids.invoice = (await post('/api/invoices', {
    customerId: ids.customer, currency: 'TRY', vatRate: 20,
    items: [{ description: 'Taban', quantity: 10, unitPrice: 100 }],
  })).id;
  await A.owner.put(`/api/products/${ids.product}`, {
    data: { name: `Taban ${RUN}`, currency: 'USD', parts: [{ materialId: ids.material, name: 'Gövde', gramsPerPiece: 200, wasteRate: 10 }] },
  });
});

test.afterAll(async () => {
  await cleanup();
});

test.describe('Firmalar arası veri ayrımı', () => {
  test("başka firmanın faturası 'ödendi' yapılamaz, kasası değiştirilemez", async () => {
    const before = await prisma.invoice.findUnique({ where: { id: ids.invoice } });
    const acc = await prisma.account.findUnique({ where: { id: ids.account } });
    const r = await B.owner.post('/api/payments', {
      data: { invoiceId: ids.invoice, accountId: ids.account, amount: 999999, currency: 'TRY', _type: 'RECEIVED' },
    });
    expect(r.status()).toBe(404);
    const after = await prisma.invoice.findUnique({ where: { id: ids.invoice } });
    expect(after?.paidAmount).toBe(before?.paidAmount);
    expect(after?.status).toBe(before?.status);
    expect((await prisma.account.findUnique({ where: { id: ids.account } }))?.balance).toBe(acc?.balance);
  });

  test('başka firmanın müşterisine fatura ve sipariş açılamaz', async () => {
    const inv = await B.owner.post('/api/invoices', {
      data: { customerId: ids.customer, currency: 'TRY', items: [{ description: 'x', quantity: 1, unitPrice: 1 }] },
    });
    expect(inv.status()).toBe(404);
    const ord = await B.owner.post('/api/orders', {
      data: { customerId: ids.customer, productId: ids.product, sizeDistribution: { '40': 1 } },
    });
    expect(ord.status()).toBe(404);
    expect(await prisma.invoice.count({ where: { customerId: ids.customer, companyId: B.companyId } })).toBe(0);
  });

  test('başka firmanın ürün reçetesi silinemez', async () => {
    const r = await B.owner.put(`/api/products/${ids.product}`, { data: { name: 'x', parts: [], extraCosts: [] } });
    expect(r.status()).toBe(404);
    expect(await prisma.productPart.count({ where: { productId: ids.product } })).toBe(1);
  });

  test('başka firmanın kategorisinin adı değiştirilemez', async () => {
    const r = await B.owner.patch(`/api/product-categories/${ids.category}`, { data: { name: 'HACKED' } });
    expect(r.status()).toBe(404);
    expect((await prisma.productCategory.findUnique({ where: { id: ids.category } }))?.name).toBe(`Kategori ${RUN}`);
  });

  test('başka firmanın ürünüyle fatura kalemi oluşturulamaz', async () => {
    const bCustomer = await (await B.owner.post('/api/customers', { data: { name: `B müşteri ${RUN}`, currency: 'TRY' } })).json();
    const r = await B.owner.post('/api/invoices', {
      data: { customerId: bCustomer.id, currency: 'TRY', items: [{ description: 'x', productId: ids.product, quantity: 1, unitPrice: 1 }] },
    });
    expect(r.status()).toBe(404);
  });

  test('çek güncellemesi kaydı başka firmaya taşıyamaz', async () => {
    const cek = await (await A.owner.post('/api/cek', {
      data: { customerId: ids.customer, borclu: 'Test', islemTarihi: '2026-11-01', vadesi: '2027-01-01', tutar: 100, currency: 'TRY' },
    })).json();
    const r = await A.owner.patch(`/api/cek/${cek.id}`, { data: { companyId: B.companyId, tutar: 1 } });
    expect(r.status()).toBeLessThan(300);
    const after = await prisma.cek.findUnique({ where: { id: cek.id } });
    expect(after?.companyId).toBe(A.companyId);
    expect(after?.tutar).toBe(100);
  });
});

test.describe('Roller ve yetkiler', () => {
  test('firma sahibi platform yöneticisi (ADMIN) yaratamaz', async () => {
    const r = await A.owner.post('/api/users', { data: { name: 'Evil', email: email('evil'), password: PASSWORD, role: 'ADMIN' } });
    expect(r.status()).toBe(403);
    const editor = await createUser(A.companyId, 'editor-up', 'EDITOR');
    const u = await prisma.user.findUnique({ where: { email: editor } });
    const p = await A.owner.patch(`/api/users/${u!.id}`, { data: { role: 'ADMIN' } });
    expect(p.status()).toBe(403);
    expect((await prisma.user.findUnique({ where: { email: editor } }))?.role).toBe('EDITOR');
  });

  test('zayıf şifreyle kullanıcı eklenemez', async () => {
    const r = await A.owner.post('/api/users', { data: { name: 'Zayıf', email: email('weak'), password: '1', role: 'EDITOR' } });
    expect(r.status()).toBe(400);
  });

  test('görüntüleyici (VIEWER) okuyabilir ama kayıt ekleyemez', async () => {
    const viewer = await loggedIn(await createUser(A.companyId, 'viewer', 'VIEWER', ['customers']));
    expect((await viewer.get('/api/customers')).status()).toBe(200);
    for (const [path, data] of [
      ['/api/customers', { name: 'V', currency: 'TRY' }],
      ['/api/payments', { customerId: ids.customer, amount: 5, currency: 'TRY' }],
      ['/api/products', { name: 'V' }],
      ['/api/accounts', { name: 'V' }],
    ] as const) {
      expect((await viewer.post(path, { data })).status(), path).toBe(403);
    }
    expect((await viewer.put('/api/settings', { data: { language: 'tr' } })).status()).toBe(200);
  });

  test('personel izni olmayan kullanıcı maaşları göremez', async () => {
    const editor = await loggedIn(await createUser(A.companyId, 'no-personnel', 'EDITOR', ['customers', 'invoices']));
    expect((await editor.get('/api/personnel')).status()).toBe(403);
    expect((await editor.get('/api/customers')).status()).toBe(200);
  });
});

test.describe('Oturum güvenliği', () => {
  test('silinen kullanıcının açık oturumu hemen geçersiz olur', async () => {
    const userEmail = await createUser(A.companyId, 'deleted', 'EDITOR', ['customers']);
    const api = await loggedIn(userEmail);
    expect((await api.get('/api/customers')).status()).toBe(200);
    await prisma.user.delete({ where: { email: userEmail } });
    expect((await api.get('/api/customers')).status()).toBe(401);
  });

  test('rolü düşürülen kullanıcının oturumu yeniden giriş ister', async () => {
    const userEmail = await createUser(A.companyId, 'demoted', 'COMPANY_OWNER');
    const api = await loggedIn(userEmail);
    expect((await api.get('/api/users')).status()).toBe(200);
    await prisma.user.update({ where: { email: userEmail }, data: { role: 'VIEWER' } });
    expect((await api.get('/api/users')).status()).toBe(401);
    expect((await api.post('/api/customers', { data: { name: 'x', currency: 'TRY' } })).status()).not.toBe(200);
  });

  test('portal müşterisi firma API’lerine erişemez', async () => {
    const portal = await loggedIn(await createPortalCustomer(ids.customer, 'portal'), PASSWORD, 'portal-credentials');
    for (const path of ['/api/customers', '/api/invoices', '/api/payments', '/api/personnel', '/api/accounts', '/api/dashboard', '/api/portal/customers']) {
      expect((await portal.get(path)).status(), path).toBe(403);
    }
    expect((await portal.post('/api/customers', { data: { name: 'x', currency: 'TRY' } })).status()).toBe(403);
    expect((await portal.get('/api/portal/me/orders')).status()).toBe(200);
  });

  test('5 hatalı denemeden sonra giriş geçici olarak kilitlenir', async () => {
    const userEmail = await createUser(A.companyId, 'locked', 'EDITOR');
    const api = await newClient();
    for (let i = 0; i < 5; i++) {
      const { session } = await login(api, userEmail, `yanlis${i}`);
      expect(session?.user).toBeFalsy();
    }
    const { session, error } = await login(api, userEmail, PASSWORD);
    expect(session?.user).toBeFalsy();
    expect(error).toBe('TOO_MANY_ATTEMPTS');
    await prisma.loginAttempt.deleteMany({ where: { key: `login:${userEmail}` } });
    expect((await login(api, userEmail, PASSWORD)).session?.user).toBeTruthy();
  });

  test('içe aktarma şablonları oturum ister', async () => {
    const anon = await newClient();
    for (const path of ['/api/customers/import/template', '/api/suppliers/import/template', '/api/cek/import/template', '/api/products/import']) {
      expect((await anon.get(path)).status(), path).toBe(401);
    }
  });
});
