// Ek tanıtım videoları için ekran görüntüleri (fason, personel, firma ağı, ekstre linki, stok, raporlar, kasa/banka).
// Ön koşul: capture.mjs ile aynı (demo veritabanıyla web 3001, mobil web çıktısı 8090) ve demo-data-ek.ts çalışmış olmalı.
// Kullanım: DATABASE_URL=<demo veritabanı> npx tsx tools/promo-video/capture-ek.ts [yalnızca-bu-adlar,virgüllü]
import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(__dirname, 'shots');
const WEB = process.env.WEB ?? 'http://localhost:3001';
const MOBILE = process.env.MOBILE ?? 'http://localhost:8090';
const STAFF = { email: 'test@solecost.com', password: 'Test123456' };
const BUYER = { email: 'satinalma@modaadim.demo', password: 'Demo12345' };
const EKSTRE_TOKEN = 'demo_ekstre_ayakkabi_dunyasi_xxxxxxxxxxxxxx';
const only = process.argv[2]?.split(',');
const want = (n: string) => !only || only.includes(n);
mkdirSync(OUT, { recursive: true });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function webLogin(browser: Browser, who: typeof STAFF) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, baseURL: WEB, locale: 'tr-TR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('whats_new_v20260510', '1'); } catch { /* */ } });
  const p = await ctx.newPage();
  await p.goto('/login');
  await p.fill('input[type=email]', who.email); await p.fill('input[type=password]', who.password);
  await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 });
  return { ctx, p };
}

async function mobileLogin(browser: Browser, who: typeof STAFF) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, baseURL: MOBILE, locale: 'tr-TR' });
  const p = await ctx.newPage();
  await p.goto('/');
  await p.getByTestId('login-email').fill(who.email);
  await p.getByTestId('login-password').fill(who.password);
  await p.getByTestId('login-submit').click();
  await wait(3000);
  if (await p.getByTestId('welcome').isVisible().catch(() => false)) await p.getByTestId('welcome').click().catch(() => {});
  return { ctx, p };
}

async function shot(p: Page, name: string, url: string | null, prep?: (p: Page) => Promise<void>) {
  if (!want(name)) return;
  if (url) await p.goto(url);
  await wait(2500);
  if (prep) await prep(p);
  await p.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(name);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  try {
    // Firma ağı: alıcı firma bir sipariş vermiş olsun (yoksa oluştur)
    const buyer = await webLogin(browser, BUYER);
    const links = await (await buyer.ctx.request.get('/api/network/links')).json();
    const link = links.asBuyer?.[0];
    const mine = await (await buyer.ctx.request.get('/api/network/orders')).json().catch(() => []);
    if (link && !(Array.isArray(mine) ? mine : mine.orders ?? []).length) {
      const r = await buyer.ctx.request.post(`/api/network/links/${link.id}/orders`, {
        data: {
          orderItems: [
            { productId: 'prod-1', color: 'Siyah', sizeDistribution: { '39': 60, '40': 120, '41': 150, '42': 120, '43': 50 } },
            { productId: 'prod-2', color: 'Taba', sizeDistribution: { '40': 80, '41': 100, '42': 80 } },
          ],
          requestedDeliveryDate: new Date(Date.now() + 14 * 86_400_000).toISOString(), notes: 'Sezon açılışı için acil.',
        },
      });
      console.log('ağ siparişi', r.status());
    }
    await shot(buyer.p, 'e-ag-tedarikci', `/suppliers/sup-yilmaz`);
    await shot(buyer.p, 'e-ag-siparis-ver', `/suppliers/sup-yilmaz/siparis`);
    await shot(buyer.p, 'e-ag-verilen', '/verilen-siparisler');
    await shot(buyer.p, 'e-ag-verilen-detay', null, async pg => {
      await pg.goto('/verilen-siparisler'); await wait(2000);
      const a = pg.locator('a[href^="/verilen-siparisler/"]').first();
      if (await a.count()) { await a.click(); await wait(2500); }
    });
    await buyer.ctx.close();

    const web = await webLogin(browser, STAFF);
    const p = web.p;
    await shot(p, 'e-fason-liste', '/subcontractor-orders');
    await shot(p, 'e-fason-detay', '/subcontractor-orders/so-1');
    await shot(p, 'e-fason-atolye', '/subcontractors/sub-1');
    await shot(p, 'e-fason-atolyeler', '/subcontractors');
    await shot(p, 'e-personel-liste', '/personnel');
    await shot(p, 'e-personel-detay', '/personnel/emp-1');
    await shot(p, 'e-ag-gelen', '/orders');
    await shot(p, 'e-musteri-ekstre', '/customers/cust-1/ekstre');
    await shot(p, 'e-hesaplar', '/accounts');
    await shot(p, 'e-hesap-detay', '/accounts/acc-1');
    await shot(p, 'e-hammadde', '/materials');
    await shot(p, 'e-urun-detay', '/products/prod-1');
    await web.ctx.close();

    // Ekstre linki: müşterinin gördüğü sayfa (telefon ve masaüstü)
    const pub = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, baseURL: WEB, locale: 'tr-TR' });
    await shot(await pub.newPage(), 'e-ekstre-link-m', `/ekstre/${EKSTRE_TOKEN}`);
    await pub.close();
    const pubD = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, baseURL: WEB, locale: 'tr-TR' });
    await shot(await pubD.newPage(), 'e-ekstre-link-w', `/ekstre/${EKSTRE_TOKEN}`);
    await pubD.close();

    const m = await mobileLogin(browser, STAFF);
    const mp = m.p;
    await shot(mp, 'em-personel', '/personel');
    await shot(mp, 'em-personel-detay', '/personel/emp-1');
    await shot(mp, 'em-raporlar', '/raporlar');
    await shot(mp, 'em-hesaplar', '/hesaplar');
    await shot(mp, 'em-hesap', '/hesaplar/acc-1');
    await shot(mp, 'em-stok', '/stok');
    await shot(mp, 'em-stok-urun', '/stok/product/prod-1');
    await shot(mp, 'em-baglantilar', '/baglantilar');
    await shot(mp, 'em-siparis', '/siparis');
    await shot(mp, 'em-ana', '/panel');
    await shot(mp, 'em-cari-ekstre', '/cariler/customer/cust-1');
    await m.ctx.close();

    const mb = await mobileLogin(browser, BUYER);
    await shot(mb.p, 'em-ag-verilen', '/siparis', async pg => { await pg.getByText('Verilen', { exact: true }).first().click(); await wait(2000); });
    await mb.ctx.close();

    // Günlük özet e-postası (sabah gelen e-postanın kendisi)
    if (want('e-gunluk-ozet')) {
      const { buildDailySummary, summaryHtml } = await import('../../lib/daily-summary');
      const s = await buildDailySummary('default-company');
      if (s) {
        const ep = await (await browser.newContext({ viewport: { width: 640, height: 1100 }, deviceScaleFactor: 2 })).newPage();
        await ep.setContent(summaryHtml(s, 'https://solecost.com/settings'), { waitUntil: 'load' });
        await ep.screenshot({ path: join(OUT, 'e-gunluk-ozet.png'), fullPage: true });
        console.log('e-gunluk-ozet');
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
