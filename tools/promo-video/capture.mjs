// Tanıtım videoları için ekran görüntüleri.
// Ön koşul: demo veritabanıyla çalışan web uygulaması (WEB, varsayılan http://localhost:3001)
// ve mobil uygulamanın web çıktısı (MOBILE, varsayılan http://localhost:8090; README'ye bakın).
// Kullanım: node tools/promo-video/capture.mjs [yalnızca-bu-adlar,virgüllü]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'shots');
const WEB = process.env.WEB ?? 'http://localhost:3001';
const MOBILE = process.env.MOBILE ?? 'http://localhost:8090';
const STAFF = { email: 'test@solecost.com', password: 'Test123456' };
const PORTAL = { email: 'portal@ayakkabidunyasi.demo', password: 'Demo12345' };
const only = process.argv[2]?.split(',');
mkdirSync(OUT, { recursive: true });

const want = n => !only || only.includes(n);
const wait = ms => new Promise(r => setTimeout(r, ms));

async function webStaff(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, baseURL: WEB, locale: 'tr-TR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('whats_new_v20260510', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto('/login');
  await p.fill('input[type=email]', STAFF.email); await p.fill('input[type=password]', STAFF.password);
  await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 });
  const shot = async (name, url, prep) => {
    if (!want(name)) return;
    await p.goto(url); await wait(2500); if (prep) await prep(p);
    await p.screenshot({ path: join(OUT, `${name}.png`) });
    console.log('web', name);
  };
  await shot('w-dashboard', '/dashboard');
  await shot('w-cekler', '/cek-portfolyo');
  await shot('w-musteriler', '/customers');
  await shot('w-cari', '/customers/cust-1');
  await shot('w-siparisler', '/orders');
  await shot('w-urun-maliyet', '/products/prod-4', async pg => {
    const b = pg.getByRole('button', { name: /Maliyet Hesapla/ });
    if (await b.count()) { await b.first().click(); await wait(1200); }
  });
  await shot('w-urunler', '/products');
  await ctx.close();
}

async function landing(browser) {
  if (!want('w-landing')) return;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, baseURL: WEB, locale: 'tr-TR' });
  const p = await ctx.newPage(); await p.goto('/'); await wait(2000);
  await p.screenshot({ path: join(OUT, 'w-landing.png') }); console.log('web w-landing');
  await ctx.close();
}

async function mobile(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, baseURL: MOBILE, locale: 'tr-TR' });
  const p = await ctx.newPage();
  await p.goto('/');
  if (who === 'portal') await p.getByText('Müşteri portalı').click();
  await p.getByTestId('login-email').fill(who === 'portal' ? PORTAL.email : STAFF.email);
  await p.getByTestId('login-password').fill(who === 'portal' ? PORTAL.password : STAFF.password);
  await p.getByTestId('login-submit').click();
  await wait(3000);
  if (await p.getByTestId('welcome').isVisible().catch(() => false)) await p.getByTestId('welcome').click().catch(() => {});
  const shot = async (name, url, prep) => {
    if (!want(name)) return;
    if (url) { await p.goto(url); }
    await wait(2500); if (prep) await prep(p);
    await p.screenshot({ path: join(OUT, `${name}.png`) });
    console.log('mobil', name);
  };
  if (who === 'staff') {
    await shot('m-ana', '/panel');
    await shot('m-cari', '/cariler/customer/cust-1');
    await shot('m-ekstre', '/cariler/customer/cust-1/ekstre', async pg => {
      const y = pg.getByText('12 ay', { exact: true });
      if (await y.count()) { await y.first().click(); await wait(2000); }
    });
    await shot('m-tahsilat', '/cariler/customer/cust-1/hareket?type=COLLECTION');
    await shot('m-cekler', '/cekler');
    await shot('m-bildirimler', '/bildirimler');
    await shot('m-siparisler', '/siparis');
    await shot('m-musteriler', '/cariler?kind=customer');
  } else {
    await shot('p-ana', '/portal');
    await shot('p-katalog', '/portal-katalog');
    await shot('p-urun', null, async pg => {
      const card = pg.locator('[data-testid^="catalog-"]:not([data-testid="catalog-search"])').first();
      if (await card.count()) { await card.click(); await wait(1500); }
    });
    await shot('p-siparisler', '/siparisler');
    await shot('p-siparis', null, async pg => {
      const row = pg.locator('[data-testid^="order-"]').first();
      if (await row.count()) { await row.click(); await wait(1500); }
    });
    await shot('p-bildirimler', '/portal-bildirimler');
  }
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
try {
  await landing(browser);
  await webStaff(browser);
  await mobile(browser, 'staff');
  await mobile(browser, 'portal');
} finally {
  await browser.close();
}
