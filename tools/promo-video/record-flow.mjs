// Süreç videosu kaydı: demo uygulamada "ürün ekle → müşteri ekle → satış → tahsilat → ekstre"
// akışını gerçekten yapar ve tek bir video olarak kaydeder. Adım sınırları shots/flow-web.json'a yazılır.
// Ön koşul: demo veritabanıyla çalışan web uygulaması (WEB, varsayılan http://localhost:3001) ve
// DATABASE_URL = demo veritabanı (önceki kaydın ürün/müşterisini arşivlemek için; yalnızca taban_demo).
// Kullanım: node tools/promo-video/record-flow.mjs
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, renameSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');
const WEB = process.env.WEB ?? 'http://localhost:3001';
const STAFF = { email: 'test@solecost.com', password: 'Test123456' };
export const FLOW = {
  urun: { ad: 'Kışlık Bot Tabanı', kod: 'TBN-010', fiyat: '92,50', stok: '1000' },
  musteri: { ad: 'Kaya Ayakkabı Ltd.', tel: '0212 444 55 66', vergi: '4567891230' },
  satis: { adet: '300' },          // 300 × 92,50 = 27.750 ₺
  tahsilat: { tutar: '20000' },     // kalan bakiye 7.750 ₺
};

// Önceki kayıtların ürün, müşteri, fatura ve tahsilatlarını siler (aynı adla temiz kayıt için).
// Silinemeyen kayıt olursa müşteri gizlenir (status=1), ürün aramada çıkmayacak bir adla yeniden adlandırılır.
async function cleanPrevious() {
  if (!/taban_demo/.test(process.env.DATABASE_URL ?? '')) throw new Error('DATABASE_URL taban_demo olmalı');
  const prisma = new PrismaClient();
  try {
    const custs = await prisma.customer.findMany({ where: { OR: [{ name: FLOW.musteri.ad }, { name: { startsWith: FLOW.musteri.ad + ' · arşiv' } }] } });
    for (const c of custs) {
      try {
        await prisma.payment.deleteMany({ where: { customerId: c.id } });
        await prisma.invoice.deleteMany({ where: { customerId: c.id } });
        await prisma.customer.delete({ where: { id: c.id } });
      } catch {
        await prisma.customer.update({ where: { id: c.id }, data: { status: 1, name: `Silinen demo ${Date.now().toString(36)}` } });
      }
    }
    const prods = await prisma.product.findMany({ where: { OR: [{ code: { startsWith: FLOW.urun.kod } }, { name: { startsWith: FLOW.urun.ad } }] } });
    for (const p of prods) {
      try { await prisma.product.delete({ where: { id: p.id } }); }
      catch { await prisma.product.update({ where: { id: p.id }, data: { name: `Eski demo ${Date.now().toString(36)}`, code: `ESK-${Date.now().toString(36)}`, portalVisible: false } }); }
    }
  } finally { await prisma.$disconnect(); }
}

// Sayfaya sahte imleç ve tıklama halkası (Playwright kayıtlarında gerçek imleç görünmez)
const CURSOR = () => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#231E19" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-3px,-2px)', transition: 'none' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 22 + 'px', top: e.clientY - 22 + 'px', width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #8A2438', zIndex: 2147483646, pointerEvents: 'none', transition: 'transform .45s ease-out, opacity .45s ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
};

const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  await cleanPrevious();
  mkdirSync(SHOTS, { recursive: true });
  const tmp = join(SHOTS, '_rec'); rmSync(tmp, { recursive: true, force: true });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

  // Giriş kayda girmesin: önce oturumu ayrı bir bağlamda aç, sonra çerezle kayıt bağlamını başlat
  const pre = await browser.newContext({ baseURL: WEB });
  const lp = await pre.newPage();
  await lp.goto('/login');
  await lp.fill('input[type=email]', STAFF.email); await lp.fill('input[type=password]', STAFF.password);
  await lp.click('button[type=submit]'); await lp.waitForURL('**/dashboard');
  const state = await pre.storageState(); await pre.close();

  const ctx = await browser.newContext({
    baseURL: WEB, viewport: { width: 1440, height: 900 }, locale: 'tr-TR', storageState: state,
    recordVideo: { dir: tmp, size: { width: 1440, height: 900 } },
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('whats_new_v20260510', '1'); } catch {} });
  await ctx.addInitScript(CURSOR);
  const t0 = Date.now();
  const p = await ctx.newPage();
  const now = () => (Date.now() - t0) / 1000;
  const marks = [];
  const track = [];   // imlecin konumu (kamera takibi için): { t, x, y }
  let cur = null;
  const step = name => { if (cur) cur.end = now(); cur = { name, start: now() }; marks.push(cur); };

  // Yardımcılar: imleci öğeye yumuşakça götür, tıkla, insan hızında yaz
  const pos = { x: 720, y: 450 };
  const moveTo = async loc => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    track.push({ t: now(), x: pos.x, y: pos.y });
    await p.mouse.move(x, y, { steps: 22 }); pos.x = x; pos.y = y;
    track.push({ t: now(), x, y }); await wait(150);
  };
  const click = async loc => { await moveTo(loc); await p.mouse.down(); await wait(60); await p.mouse.up(); await wait(350); };
  const type = async (loc, text) => { await click(loc); await p.keyboard.type(text, { delay: 70 }); await wait(250); };
  const field = label => p.locator(`xpath=//label[contains(normalize-space(.), "${label}")]/following-sibling::*[1]`).first();

  await p.goto('/dashboard'); await wait(1500);
  await p.mouse.move(pos.x, pos.y);

  // 1 · Ürün ekle
  step('urun');
  await click(p.getByRole('link', { name: 'Ürünler', exact: true }).first()); await p.waitForURL('**/products'); await wait(1200);
  await click(p.getByRole('link', { name: /Yeni Ürün/ }).first()); await p.waitForURL('**/products/new'); await wait(900);
  await type(field('Ürün Adı'), FLOW.urun.ad);
  await type(field('Ürün Kodu'), FLOW.urun.kod);
  await moveTo(field('Birim'));
  await type(field('Birim Fiyat'), FLOW.urun.fiyat);
  await moveTo(field('Para Birimi')); await field('Para Birimi').selectOption('TRY'); await wait(300);
  await type(field('Mevcut Stok'), FLOW.urun.stok);
  await click(p.getByRole('button', { name: /Kaydet/ }).first());
  await p.waitForURL(/\/products\/[^/]+\?edit=true/); await wait(2200);

  // 2 · Müşteri ekle
  step('musteri');
  await click(p.getByRole('link', { name: 'Müşteriler', exact: true }).first()); await p.waitForURL('**/customers'); await wait(1200);
  await click(p.getByRole('link', { name: /Yeni Müşteri/ }).first()); await p.waitForURL('**/customers/new'); await wait(900);
  await type(p.locator('form input[required]').first(), FLOW.musteri.ad);
  await type(field('Vergi'), FLOW.musteri.vergi);
  await type(field('Telefon'), FLOW.musteri.tel);
  await click(p.getByRole('button', { name: /Kaydet/ }).first());
  await p.waitForURL(/\/customers\/(?!new)[^/]+$/); await wait(2200);
  const customerUrl = p.url();

  // 3 · Satış
  step('satis');
  await click(p.getByRole('link', { name: /Yeni Satış/ }).first()); await p.waitForURL(/\/invoices\/new/); await wait(1500);
  const search = p.getByPlaceholder(/Ürün adı, kodu/);
  await type(search, 'Kışlık');
  await wait(900);
  await click(p.locator('[onmousedown], button, li, div').filter({ hasText: FLOW.urun.kod }).last());
  await wait(900);
  const qty = p.locator('form').last().locator('input[inputmode=decimal]').first();
  await click(qty); await p.keyboard.press('Control+A'); await p.keyboard.type(FLOW.satis.adet, { delay: 90 }); await wait(500);
  await click(p.getByRole('button', { name: /Kalem Ekle|Ekle/ }).last()); await wait(1300);
  await click(p.getByRole('button', { name: /Faturayı Kaydet|Kaydet/ }).last());
  await p.waitForURL(u => !/\/invoices\/new/.test(u.toString()), { timeout: 15000 }).catch(() => {});
  await p.waitForLoadState('networkidle').catch(() => {}); await wait(1500);

  // 4 · Tahsilat
  step('tahsilat');
  await p.goto(customerUrl); await wait(1800);
  await click(p.getByRole('button', { name: /Tahsilat\/Ödeme/ }).first());
  await click(p.getByRole('button', { name: /Nakit \/ KK \/ Banka/ }).first()); await wait(800);
  const dialog = p.locator('form').last();
  const acc = dialog.locator('select').first(); await moveTo(acc);
  const opt = await acc.locator('option').evaluateAll(os => (os.find(o => /Kasa/.test(o.textContent) && o.value) ?? os.find(o => o.value))?.value);
  await acc.selectOption(opt); await wait(500);
  await type(dialog.locator('input[inputmode=decimal], input[type=number]').first(), FLOW.tahsilat.tutar);
  await click(dialog.getByRole('button', { name: /Kaydet/ }).last());
  await wait(2800);

  // 5 · Ekstre
  step('ekstre');
  await click(p.getByRole('link', { name: /Hesap Ekstresi/ }).first()).catch(async () => { await p.goto(customerUrl + '/ekstre'); });
  await p.waitForURL(/\/ekstre/); await wait(1200);
  const show = p.getByRole('button', { name: /Göster|Getir|Ekstre/ }).first();
  if (await show.count()) await click(show);
  await wait(2200);
  await p.mouse.wheel(0, 300); await wait(1200);
  await moveTo(p.getByRole('button', { name: /PDF/ }).first()); await wait(1800);
  cur.end = now();

  await ctx.close();
  await browser.close();
  const file = readdirSync(tmp).find(f => f.endsWith('.webm'));
  renameSync(join(tmp, file), join(SHOTS, 'flow-web.webm')); rmSync(tmp, { recursive: true, force: true });
  const data = JSON.stringify({ size: [1440, 900], marks, track });
  writeFileSync(join(SHOTS, 'flow-web.json'), data);
  writeFileSync(join(SHOTS, 'flow-web.js'), `window.FLOW_DATA = ${data};`); // compose.html file:// üzerinden okur
  console.log('kayıt tamam:', marks.map(m => `${m.name} ${m.start.toFixed(1)}-${m.end.toFixed(1)}`).join(' · '));
}

main().catch(e => { console.error(e); process.exit(1); });
