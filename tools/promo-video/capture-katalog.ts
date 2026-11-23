// "Katalog WhatsApp'ta" videosu için ekran görüntüleri: mobilde fotoğraflı ürün ekleme, Katalog ekranında seçim
// ve uygulamanın ürettiği gerçek katalog PDF'inin sayfaları.
// Ön koşul: capture.mjs ile aynı (demo veritabanıyla web 3001, mobil web çıktısı 8090).
// Kullanım: npx tsx tools/promo-video/capture-katalog.ts <ürün-fotoğrafı.jpg>
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { catalogHtml } from '../../mobile/src/core/catalog-html';

const OUT = join(__dirname, 'shots');
const WEB = process.env.WEB ?? 'http://localhost:3001';
const MOBILE = process.env.MOBILE ?? 'http://localhost:8090';
const STAFF = { email: 'test@solecost.com', password: 'Test123456' };
const NEW = { name: 'Yazlık Espadril Taban', code: 'TBN-011', price: '3,40', stock: '1200' };
const CUSTOMER = 'Ayakkabı Dünyası A.Ş.';
const TITLE = 'Yaz 2027 Taban Kataloğu';
const photo = process.argv[2];
if (!photo) { console.error('Kullanım: tsx capture-katalog.ts <foto.jpg>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const shot = async (p: Page, name: string) => { await p.screenshot({ path: join(OUT, `${name}.png`) }); console.log(name); };

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  try {
    // Önceki çalıştırmadan kalan ürünü sil (web oturumuyla)
    const web = await browser.newContext({ baseURL: WEB });
    const wp = await web.newPage();
    await wp.goto('/login');
    await wp.fill('input[type=email]', STAFF.email); await wp.fill('input[type=password]', STAFF.password);
    await wp.click('button[type=submit]'); await wp.waitForURL('**/dashboard', { timeout: 30000 });
    const list = await (await web.request.get('/api/products')).json() as any[];
    for (const p of list.filter(x => x.code === NEW.code)) await web.request.delete(`/api/products/${p.id}`);

    // Mobil
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, baseURL: MOBILE, locale: 'tr-TR' });
    const p = await ctx.newPage();
    await p.goto('/');
    await p.getByTestId('login-email').fill(STAFF.email);
    await p.getByTestId('login-password').fill(STAFF.password);
    await p.getByTestId('login-submit').click();
    await wait(3000);
    if (await p.getByTestId('welcome').isVisible().catch(() => false)) await p.getByTestId('welcome').click().catch(() => {});

    await p.goto('/urunler/yeni'); await wait(2500);
    await shot(p, 'k-urun-bos');
    await p.getByTestId('product-name').fill(NEW.name);
    await p.getByTestId('product-code').fill(NEW.code);
    await p.getByTestId('product-price').fill(NEW.price);
    await p.getByTestId('product-stock').fill(NEW.stock);
    await p.getByText('USD', { exact: true }).first().click();
    await p.getByTestId('product-image').click(); await wait(800);
    await shot(p, 'k-urun-sheet');
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('image-library').click()]);
    await chooser.setFiles(photo); await wait(2500);
    await p.evaluate(() => window.scrollTo(0, 0));
    await shot(p, 'k-urun-dolu');
    await p.getByTestId('product-save').click(); await wait(3000);
    await shot(p, 'k-urun-kayit');

    await p.goto('/urunler'); await wait(3000);
    await shot(p, 'k-urunler');

    await p.goto('/katalog'); await wait(3000);
    await p.getByTestId('catalog-title').fill(TITLE);
    await p.getByTestId('catalog-customer').fill(CUSTOMER); await wait(300);
    await shot(p, 'k-katalog');
    const rows = p.locator('[data-testid^="catalog-"]:not([data-testid="catalog-title"]):not([data-testid="catalog-customer"]):not([data-testid="catalog-prices"]):not([data-testid="catalog-all"]):not([data-testid="catalog-pdf"])');
    // Yeni eklenen ürün önce, ardından listedeki ilk beş ürün (katalogun ilk sayfası: 6 ürün)
    const n = await rows.count();
    const ids: string[] = [];
    const newRow = rows.filter({ hasText: NEW.name });
    ids.push(((await newRow.getAttribute('data-testid')) ?? '').replace(/^catalog-/, ''));
    for (let i = 0; i < n && ids.length < 6; i++) {
      const id = ((await rows.nth(i).getAttribute('data-testid')) ?? '').replace(/^catalog-/, '');
      if (!ids.includes(id)) ids.push(id);
    }
    for (const id of ids) { await p.getByTestId(`catalog-${id}`).click(); await wait(250); }
    await wait(600);
    await shot(p, 'k-katalog-secili');
    await ctx.close();

    // Uygulamanın kullandığı uç ve şablonla gerçek katalog PDF'i
    const data = await (await web.request.post('/api/products/catalog-pdf', { data: { productIds: ids } })).json();
    const html = catalogHtml(data.company ?? { name: 'SoleCost', logoUrl: null, phone: null, address: null }, data.products,
      { title: TITLE, customerName: CUSTOMER, showPrices: true, date: new Date() });
    const pdfp = await (await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })).newPage();
    await pdfp.setContent(html, { waitUntil: 'load' }); await wait(500);
    await pdfp.addStyleTag({ content: 'body{margin:0;padding:53px 45px;background:#fff}' });
    await pdfp.screenshot({ path: join(OUT, 'k-pdf.png'), fullPage: false });
    await pdfp.screenshot({ path: join(OUT, 'k-pdf-tam.png'), fullPage: true });
    console.log('k-pdf');
    await web.close();
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
