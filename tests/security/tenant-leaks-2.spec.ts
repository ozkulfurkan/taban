import { test, expect, APIRequestContext } from '@playwright/test';
import bcrypt from 'bcryptjs';
import {
  prisma, PASSWORD, RUN, createCompany, createUser, createPortalCustomer, loggedIn, newClient, cleanup,
} from './helpers';

// İkinci güvenlik denetiminde bulunan açıklar: her test önce saldırıyı dener, sonra
// başka firmanın verisinin değişmediğini / görünmediğini doğrular.

let A: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let B: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;

test.beforeAll(async () => {
  A = await createCompany('sizinti2-a');
  B = await createCompany('sizinti2-b');
  anon = await newClient();
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

const uid = () => Math.random().toString(36).slice(2, 7);

test('destek eki: HTML dosyası tarayıcıda açılmaz, indirilir (yönetici oturumu çalınamaz)', async () => {
  const viewer = await loggedIn(await createUser(A.companyId, `destek-viewer-${uid()}`, 'VIEWER'));
  const html = '<html><body><script>fetch("/api/admin/impersonate")</script></body></html>';
  const r = await viewer.post('/api/support/tickets', {
    multipart: {
      title: `XSS ${RUN}`, description: 'ek', type: 'BUG',
      screenshot: { name: 'ekran"\r\nX-Evil: 1.html', mimeType: 'text/html', buffer: Buffer.from(html) },
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  const ticket = await r.json();
  const att = await prisma.ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } });

  const dl = await A.owner.get(`/api/support/tickets/${ticket.id}/attachments/${att.id}`);
  expect(dl.status()).toBe(200);
  const h = dl.headers();
  expect(h['content-type']).toBe('application/octet-stream');
  expect(h['content-disposition']).toMatch(/^attachment;/);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-evil']).toBeUndefined();

  // Resimler önizleme için tarayıcıda açılmaya devam eder
  const png = await viewer.post('/api/support/tickets', {
    multipart: { title: `PNG ${RUN}`, description: 'ek', screenshot: { name: 'ekran.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) } },
  });
  const pngTicket = await png.json();
  const pngAtt = await prisma.ticketAttachment.findFirstOrThrow({ where: { ticketId: pngTicket.id } });
  const img = await A.owner.get(`/api/support/tickets/${pngTicket.id}/attachments/${pngAtt.id}`);
  expect(img.headers()['content-type']).toBe('image/png');
  expect(img.headers()['content-disposition']).toMatch(/^inline;/);
  await viewer.dispose();
});

test('başka firmanın alış kalemi fiyatı değiştirilemez', async () => {
  const supA = await prisma.supplier.create({ data: { companyId: A.companyId, name: `Ted A ${RUN}` } });
  const supB = await prisma.supplier.create({ data: { companyId: B.companyId, name: `Ted B ${RUN}` } });
  const purA = await prisma.purchase.create({ data: { companyId: A.companyId, supplierId: supA.id, date: new Date() } });
  const purB = await prisma.purchase.create({ data: { companyId: B.companyId, supplierId: supB.id, date: new Date() } });
  const lineB = await prisma.purchaseMaterial.create({ data: { purchaseId: purB.id, kgAmount: 10, pricePerKg: 5 } as any });

  const r = await A.owner.patch(`/api/purchases/${purA.id}/hammaddeler`, { data: { entryId: lineB.id, pricePerKg: 0 } });
  expect(r.status()).toBe(404);
  expect((await prisma.purchaseMaterial.findUniqueOrThrow({ where: { id: lineB.id } })).pricePerKg).toBe(5);
});

test('başka firmanın personeline izin, not ve mesai eklenemez; izin bakiyesi değişmez', async () => {
  const empB = await prisma.employee.create({
    data: { companyId: B.companyId, name: `Personel B ${RUN}`, department: 'Üretim', role: 'Usta', hireDate: new Date(), leaveBalance: 14 } as any,
  });
  const leave = await A.owner.post(`/api/personnel/${empB.id}/leaves`, {
    data: { startDate: '2026-01-01', endDate: '2026-01-10', type: 'YILLIK', days: 9999 },
  });
  expect(leave.status()).toBe(404);
  expect(((await prisma.employee.findUniqueOrThrow({ where: { id: empB.id } })) as any).leaveBalance).toBe(14);

  expect((await A.owner.post(`/api/personnel/${empB.id}/notes`, { data: { note: 'x', content: 'x', type: 'GENEL' } })).status()).toBe(404);
  expect((await A.owner.post(`/api/personnel/${empB.id}/overtimes`, { data: { date: '2026-01-01', hours: 2 } })).status()).toBe(404);
  expect(await (prisma as any).personnelLeave.count({ where: { employeeId: empB.id } })).toBe(0);
  expect(await (prisma as any).personnelNote.count({ where: { employeeId: empB.id } })).toBe(0);
  expect(await (prisma as any).personnelOvertime.count({ where: { employeeId: empB.id } })).toBe(0);
});

test('üretim görünümü başka firmanın hammadde adını ve stokunu göstermez', async () => {
  const secret = `Gizli Hammadde B ${RUN}`;
  const matB = await prisma.material.create({ data: { companyId: B.companyId, name: secret, pricePerKg: 1, stock: 777 } as any });
  const matA = await prisma.material.create({ data: { companyId: A.companyId, name: `Hammadde A ${RUN}`, pricePerKg: 1 } });
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Müşteri A ${RUN}` } });
  const product = await prisma.product.create({
    data: { companyId: A.companyId, name: `Taban A ${RUN}`, parts: { create: { name: 'Taban', materialId: matA.id, gramsPerPiece: 100 } } },
    include: { parts: true },
  });
  const order = await prisma.soleOrder.create({
    data: { companyId: A.companyId, customerId: cust.id, productId: product.id, orderNo: `SZ-${RUN}`, sizeDistribution: { '40': 10 }, totalQuantity: 10, status: 'IN_PRODUCTION' },
  });

  // Siparişe başka firmanın hammaddesi bağlanamaz
  const put = await A.owner.put(`/api/orders/${order.id}`, { data: { partVariantsData: [{ partId: product.parts[0].id, materialId: matB.id }] } });
  expect(put.status()).toBe(404);

  // Eski kayıtlarda bulunsa bile üretim görünümüne sızmaz
  await prisma.soleOrder.update({ where: { id: order.id }, data: { partVariantsData: [{ partId: product.parts[0].id, materialId: matB.id }] } });
  const r = await A.owner.get('/api/orders/uretim');
  expect(r.status()).toBe(200);
  const text = await r.text();
  expect(text).not.toContain(secret);
  expect(text).not.toContain('777');
});

test('portal hesap listesi şifre hash’ini ve doğrulama token’ını döndürmez', async () => {
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Portal Müşteri ${RUN}` } });
  const pc = await prisma.portalCustomer.create({
    data: { email: `sec-pc-${uid()}-${RUN}@test.local`, customerId: cust.id, password: await bcrypt.hash(PASSWORD, 10), emailVerifyToken: `tok-${RUN}-${uid()}` },
  });
  const viewer = await loggedIn(await createUser(A.companyId, `portal-viewer-${uid()}`, 'VIEWER'));
  const list = await viewer.get('/api/portal/customers');
  expect(list.status()).toBe(200);
  const row = (await list.json()).find((x: any) => x.id === pc.id);
  expect(row).toBeTruthy();
  expect(row.password).toBeUndefined();
  expect(row.emailVerifyToken).toBeUndefined();

  const patched = await A.owner.put(`/api/portal/customers/${pc.id}`, { data: { isActive: true } });
  expect(patched.status()).toBe(200);
  const body = await patched.json();
  expect(body.password).toBeUndefined();
  expect(body.emailVerifyToken).toBeUndefined();
  await viewer.dispose();
});

test('şifre değişince eski web oturumu ve mobil token geçersiz olur', async () => {
  const editorEmail = await createUser(A.companyId, `sifre-${uid()}`, 'EDITOR');
  const web = await loggedIn(editorEmail);
  const login = await anon.post('/api/mobile/auth/login', { data: { email: editorEmail, password: PASSWORD, kind: 'staff' } });
  expect(login.status()).toBe(200);
  const token = (await login.json()).token as string;
  const bearer = { Authorization: `Bearer ${token}` };
  expect((await anon.get('/api/customers', { headers: bearer })).status()).toBe(200);

  await new Promise(r => setTimeout(r, 1100)); // token zamanı saniye hassasiyetinde
  const editor = await prisma.user.findUniqueOrThrow({ where: { email: editorEmail } });
  const change = await A.owner.patch(`/api/users/${editor.id}`, { data: { newPassword: 'YeniSifre123' } });
  expect(change.status(), await change.text()).toBe(200);

  expect((await anon.get('/api/customers', { headers: bearer })).status()).toBe(401);
  expect((await web.get('/api/customers')).status()).toBe(401);
  // Yeni şifreyle giriş çalışır
  const fresh = await loggedIn(editorEmail, 'YeniSifre123');
  expect((await fresh.get('/api/customers')).status()).toBe(200);
  await Promise.all([web.dispose(), fresh.dispose()]);
});

test('portal şifresi sıfırlanınca portal müşterisinin eski mobil token’ı geçersiz olur', async () => {
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Portal Sifre ${RUN}` } });
  const portalEmail = await createPortalCustomer(cust.id, `portal-sifre-${uid()}`);
  const login = await anon.post('/api/mobile/auth/login', { data: { email: portalEmail, password: PASSWORD, kind: 'portal' } });
  expect(login.status(), await login.text()).toBe(200);
  const bearer = { Authorization: `Bearer ${(await login.json()).token}` };
  expect((await anon.get('/api/portal/me/orders', { headers: bearer })).status()).toBe(200);

  await new Promise(r => setTimeout(r, 1100));
  const pc = await prisma.portalCustomer.findFirstOrThrow({ where: { email: portalEmail } });
  expect((await A.owner.put(`/api/portal/customers/${pc.id}`, { data: { newPassword: 'YeniSifre123' } })).status()).toBe(200);
  expect((await anon.get('/api/portal/me/orders', { headers: bearer })).status()).toBe(401);
});

test('portal müşterisi kataloğunda olmayan ürünü sipariş edemez; yanıtta satıcının iç alanları yok', async () => {
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Portal Katalog ${RUN}` } });
  const portal = await loggedIn(await createPortalCustomer(cust.id, `portal-katalog-${uid()}`), PASSWORD, 'portal-credentials');
  const hidden = await prisma.product.create({ data: { companyId: A.companyId, name: `Gizli Ürün ${RUN}`, unit: 'çift', portalVisible: false } as any });
  const visible = await prisma.product.create({ data: { companyId: A.companyId, name: `Açık Ürün ${RUN}`, unit: 'çift', portalVisible: true } as any });
  const item = (productId: string) => ({ productId, color: 'Siyah', sizeDistribution: { '40': 5 } });

  const bad = await portal.post('/api/portal/me/orders', { data: { orderItems: [item(hidden.id)] } });
  expect(bad.status()).toBe(404);
  expect(await bad.text()).not.toContain('Gizli Ürün');
  expect(await prisma.soleOrder.count({ where: { productId: hidden.id } })).toBe(0);

  const ok = await portal.post('/api/portal/me/orders', { data: { orderItems: [item(visible.id)] } });
  expect(ok.status(), await ok.text()).toBe(201);
  const created = await ok.json();
  await prisma.soleOrder.update({ where: { id: created.id }, data: { partVariantsData: [{ partId: 'x', materialId: 'y' }] } });

  const list = await (await portal.get('/api/portal/me/orders')).json();
  const mine = list.find((o: any) => o.id === created.id);
  expect(mine).toBeTruthy();
  for (const key of ['partVariantsData', 'invoiceId', 'companyId', 'customerId', 'buyerUserId']) expect(mine[key]).toBeUndefined();
  const detail = await (await portal.get(`/api/portal/me/orders/${created.id}`)).json();
  expect(detail.partVariantsData).toBeUndefined();
  expect(detail.orderNo).toBe(mine.orderNo);
  await portal.dispose();
});

test('ürün portal görünürlüğüne başka firmanın portal müşterisi atanamaz', async () => {
  const custB = await prisma.customer.create({ data: { companyId: B.companyId, name: `B Portal ${RUN}` } });
  const pcB = await prisma.portalCustomer.create({ data: { email: `sec-pcb-${uid()}-${RUN}@test.local`, customerId: custB.id, password: 'x' } });
  const product = await prisma.product.create({ data: { companyId: A.companyId, name: `Görünürlük ${RUN}` } });
  const r = await A.owner.put(`/api/products/${product.id}/portal-visibility`, { data: { portalVisible: true, assignedCustomerIds: [pcB.id] } });
  expect(r.status()).toBe(404);
  expect(await prisma.productPortalCustomer.count({ where: { productId: product.id } })).toBe(0);
});

test('kur güncelleme ucu secret olmadan çalışmaz; test e-postası yalnızca platform yöneticisine açık', async () => {
  const before = await prisma.company.findUniqueOrThrow({ where: { id: B.companyId }, select: { usdToTry: true } });
  expect((await anon.get('/api/cron/update-rates')).status()).toBe(401);
  expect((await anon.get('/api/cron/update-rates', { headers: { Authorization: 'Bearer yanlis' } })).status()).toBe(401);
  expect((await prisma.company.findUniqueOrThrow({ where: { id: B.companyId }, select: { usdToTry: true } })).usdToTry).toBe(before.usdToTry);

  expect((await A.owner.post('/api/test-mail', { data: { email: 'biri@example.com' } })).status()).toBe(403);
});

test('barkod sıra numarası tek istekte en fazla 1000 adet üretir', async () => {
  const r = await A.owner.get('/api/barcode/next-sequence?count=100000000');
  expect(r.status()).toBe(200);
  const body = await r.json();
  const n = Array.isArray(body) ? body.length : (body.barcodes ?? body.sequences ?? body.numbers ?? []).length;
  expect(n).toBeLessThanOrEqual(1000);
});

test('tüm sayfalarda güvenlik başlıkları var', async () => {
  const r = await anon.get('/login');
  expect(r.headers()['x-content-type-options']).toBe('nosniff');
  expect(r.headers()['x-frame-options']).toBe('SAMEORIGIN');
});
