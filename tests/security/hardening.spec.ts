import { test, expect, APIRequestContext } from '@playwright/test';
import { BASE_URL, createCompany, cleanup, email } from './helpers';

// Sıkılaştırma: güvenlik başlıkları (HSTS, CSP), HTTP→HTTPS yönlendirmesi, sürüm bilgisi gizleme,
// güçlü şifre kuralı ve içe aktarma dosya boyutu sınırı.
let A: { companyId: string; owner: APIRequestContext };
test.beforeAll(async () => { A = await createCompany('sikilastirma'); });
test.afterAll(async () => { await cleanup(); });

test('güvenlik başlıkları: HSTS, CSP, nosniff, çerçeve koruması; sürüm bilgisi yok', async ({ request }) => {
  for (const path of ['/login', '/api/auth/csrf']) {
    const h = (await request.get(`${BASE_URL}${path}`)).headers();
    expect(h['strict-transport-security'], path).toContain('max-age=63072000');
    expect(h['content-security-policy'], path).toContain("frame-ancestors 'self'");
    expect(h['content-security-policy'], path).toContain("object-src 'none'");
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['x-frame-options'], path).toBe('SAMEORIGIN');
    expect(h['x-powered-by'], path).toBeUndefined();
  }
});

test('HTTP ile gelen istek HTTPS adresine kalıcı yönlenir', async ({ request }) => {
  const r = await request.get(`${BASE_URL}/login`, { headers: { 'x-forwarded-proto': 'http', host: 'app.solecost.test' }, maxRedirects: 0 });
  expect([301, 308]).toContain(r.status());
  expect(r.headers()['location']).toBe('https://app.solecost.test/login');
});

test('şifre kuralı: kısa, harfsiz, yaygın ya da e-postayı içeren şifre kabul edilmez', async () => {
  const mail = email('yeni-kul');
  for (const pw of ['Ab12345', 'abcdefghij', '1234567890', 'password123', 'Qwerty123'.toLowerCase(), mail.split('@')[0] + '9a']) {
    const r = await A.owner.post('/api/users', { data: { email: mail, password: pw, role: 'EDITOR', allowedPages: [] } });
    expect(r.status(), pw).toBe(400);
  }
  expect((await A.owner.post('/api/users', { data: { email: mail, password: 'Taban2026Guclu', role: 'EDITOR', allowedPages: [] } })).status()).toBeLessThan(300);
});

test('içe aktarma: 5 MB üstü dosya reddedilir', async () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 10, 65);
  const r = await A.owner.post('/api/customers/import', { multipart: { file: { name: 'buyuk.csv', mimeType: 'text/csv', buffer: big } } });
  expect(r.status()).toBe(413);
});
