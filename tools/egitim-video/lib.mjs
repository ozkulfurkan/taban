// Eğitim videoları: demo uygulamada gerçek işlemleri yapan, ekranda adım adım açıklama yazan kayıt altyapısı.
// Her modül modules/<slug>.mjs içinde { slug, title, summary, run(h) } olarak tanımlanır; record.mjs çalıştırır.
// Çıktı: out/<slug>.mp4 (1920×1080, H.264). Ön koşul: demo veritabanıyla çalışan web (WEB, varsayılan :3001).
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { mkdirSync, readdirSync, rmSync, renameSync } from 'fs';
import { join } from 'path';

/** Demo veritabanında SQL (yalnızca taban_demo): kayıt öncesi temizlik için */
export const sql = q => execFileSync('psql', ['-h', 'localhost', '-U', 'postgres', '-d', 'taban_demo', '-tAc', q], { env: { ...process.env, PGPASSWORD: 'postgres' } }).toString().trim();

export const WEB = process.env.WEB ?? 'http://localhost:3001';
export const STAFF = { email: 'test@solecost.com', password: 'Test123456' };
export const PORTAL = { email: 'portal@ayakkabidunyasi.demo', password: 'Demo12345' };
export const BUYER = { email: 'satinalma@modaadim.demo', password: 'Demo12345' };
const VIEW = { width: 1280, height: 720 }; // 1080p'ye büyütülür: arayüz yazıları videoda okunaklı
const BRAND = '#6B1A2C';

export const wait = ms => new Promise(r => setTimeout(r, ms));

// Sayfaya eklenen katman: imleç, tıklama halkası, altyazı bandı, modül etiketi, vurgu çerçevesi.
// Altyazı sessionStorage'da tutulur; sayfa değişince yeniden çizilir.
const OVERLAY = () => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const css = document.createElement('style');
    css.textContent = `
      #__cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:78%;z-index:2147483645;pointer-events:none;
        background:rgba(35,30,25,.92);color:#fff;border-radius:14px;padding:14px 22px 14px 18px;display:flex;gap:14px;align-items:center;
        font:600 21px/1.35 Inter,'Helvetica Neue',Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .25s}
      #__cap b{flex:none;background:#8A2438;color:#fff;border-radius:10px;min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px}
      #__mod{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:2147483645;pointer-events:none;background:${'#6B1A2C'};color:#fff;border-radius:999px;
        padding:5px 12px;font:700 13px Inter,Arial,sans-serif;letter-spacing:.02em;opacity:.95}
      .__hl{outline:4px solid #E0A526 !important;outline-offset:3px !important;border-radius:8px;transition:outline-color .2s}`;
    document.documentElement.appendChild(css);
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#231E19" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-50px', top: '-50px', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-3px,-2px)' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 22 + 'px', top: e.clientY - 22 + 'px', width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #8A2438', zIndex: 2147483646, pointerEvents: 'none', transition: 'transform .45s ease-out, opacity .45s ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
    window.__setCap = (n, text, mod) => {
      try { sessionStorage.setItem('__cap', JSON.stringify({ n, text, mod })); } catch {}
      let cap = document.getElementById('__cap');
      if (!text) { cap?.remove(); } else {
        if (!cap) { cap = document.createElement('div'); cap.id = '__cap'; document.documentElement.appendChild(cap); }
        cap.innerHTML = (n ? `<b>${n}</b>` : '') + `<span></span>`; cap.querySelector('span').textContent = text;
      }
      let m = document.getElementById('__mod');
      if (mod && window.__showMod) { if (!m) { m = document.createElement('div'); m.id = '__mod'; document.documentElement.appendChild(m); } m.textContent = mod; } else m?.remove();
    };
    try { const s = JSON.parse(sessionStorage.getItem('__cap') || 'null'); if (s) window.__setCap(s.n, s.text, s.mod); } catch {}
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
};

// Başlık / kapanış kartı (kayda giren tam ekran sayfa)
const card = (kicker, title, lines, foot) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:${BRAND};color:#fff;font-family:Inter,'Helvetica Neue',Arial,sans-serif}
  .w{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 110px;box-sizing:border-box}
  .logo{display:flex;align-items:center;gap:16px;font-weight:800;font-size:34px;margin-bottom:48px}
  .logo i{width:60px;height:60px;border-radius:16px;background:#fff;color:${BRAND};display:flex;align-items:center;justify-content:center;font-style:normal;font-size:24px}
  .k{font-size:24px;letter-spacing:.14em;text-transform:uppercase;opacity:.75;font-weight:700}
  h1{font-size:64px;margin:14px 0 26px;line-height:1.05}
  ul{margin:0;padding:0;list-style:none;font-size:26px;line-height:1.6;opacity:.95}
  li:before{content:'— ';opacity:.6}
  .f{margin-top:56px;font-size:24px;opacity:.75}
</style></head><body><div class="w"><div class="logo"><i>SC</i>SoleCost</div><div class="k">${kicker}</div><h1>${title}</h1>
<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>${foot ? `<div class="f">${foot}</div>` : ''}</div></body></html>`;

async function loginState(browser, who) {
  const ctx = await browser.newContext({ baseURL: WEB });
  const p = await ctx.newPage();
  if (who === 'portal') {
    await p.goto('/portal/login');
    await p.fill('input[type=email]', PORTAL.email); await p.fill('input[type=password]', PORTAL.password);
    await p.click('button[type=submit]'); await p.waitForURL('**/portal/dashboard');
  } else {
    const u = who === 'buyer' ? BUYER : STAFF;
    await p.goto('/login');
    await p.fill('input[type=email]', u.email); await p.fill('input[type=password]', u.password);
    await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');
  }
  const s = await ctx.storageState(); await ctx.close(); return s;
}

/** Modülü kaydeder ve out/<slug>.mp4 üretir */
export async function record(mod, outDir) {
  mkdirSync(outDir, { recursive: true });
  if (mod.prepare) await mod.prepare();
  const tmp = join(outDir, `_rec_${mod.slug}`); rmSync(tmp, { recursive: true, force: true });
  // Mobil web çıktısı (:8090) demo API'ye (:3001) başka kökenden bağlanır; yalnız kayıt tarayıcısında CORS kapatılır
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: mod.slug === 'mobil' ? ['--disable-web-security'] : [] });
  const states = {};
  const state = async who => (states[who] ??= await loginState(browser, who));

  const ctx = await browser.newContext({ timezoneId: 'Europe/Istanbul',
    baseURL: WEB, viewport: VIEW, locale: 'tr-TR', storageState: await state(mod.as ?? 'staff'),
    recordVideo: { dir: tmp, size: VIEW },
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('whats_new_v20260510', '1'); localStorage.setItem('lang', 'tr'); } catch {} window.print = () => {}; });
  await ctx.addInitScript(OVERLAY);
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  const pos = { x: VIEW.width / 2, y: VIEW.height / 2 };
  let n = 0;

  const h = {
    p, wait, pos,
    /** Ekrandaki açıklama (numaralı adım). ms: okuma süresi */
    say: async (text, ms = 2600) => { n += 1; if (process.env.STEPS) console.log('  ·', n, text.slice(0, 60)); await p.evaluate(([a, b, c]) => window.__setCap?.(a, b, c), [n, text, mod.title]); await wait(ms); },
    /** Numarasız not */
    note: async (text, ms = 2400) => { await p.evaluate(([b, c]) => window.__setCap?.(0, b, c), [text, mod.title]); await wait(ms); },
    hide: async () => p.evaluate(c => window.__setCap?.(0, '', c), mod.title),
    go: async (url, ms = 1600) => { await p.goto(url); await p.waitForLoadState('networkidle').catch(() => {}); await wait(ms); },
    moveTo: async loc => {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const b = await loc.boundingBox();
      if (!b) return;
      const x = b.x + Math.min(b.width / 2, 120), y = b.y + b.height / 2;
      await p.mouse.move(x, y, { steps: 20 }); pos.x = x; pos.y = y; await wait(180);
    },
    /** Öğeyi kısa süre sarı çerçeveyle vurgular */
    point: async (loc, ms = 1400) => {
      await h.moveTo(loc);
      await loc.evaluate(el => el.classList.add('__hl')).catch(() => {});
      await wait(ms);
      await loc.evaluate(el => el.classList.remove('__hl')).catch(() => {});
    },
    click: async (loc, after = 700) => { await h.moveTo(loc); await p.mouse.down(); await wait(70); await p.mouse.up(); await wait(after); },
    type: async (loc, text, delay = 55) => { await h.click(loc, 200); await p.keyboard.press('Control+A'); await p.keyboard.type(text, { delay }); await wait(300); },
    select: async (loc, value) => { await h.moveTo(loc); await loc.selectOption(value); await wait(500); },
    field: label => p.locator(`xpath=//label[contains(normalize-space(.), "${label}")]/following-sibling::*[1]`).first(),
    scroll: async (dy, ms = 900) => { await p.mouse.wheel(0, dy); await wait(ms); },
    card: async (kicker, title, lines, foot, ms = 4500) => { await h.hide(); await p.setContent(card(kicker, title, lines, foot)); await wait(ms); },
    /** Mobil uygulamayı telefon çerçevesinde açar (sol), açıklamalar sağda; iç çerçeveyi döndürür */
    phone: async url => {
      await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;height:100%;background:${BRAND};font-family:Inter,Arial,sans-serif;overflow:hidden}
        .ph{position:absolute;left:150px;top:14px;width:332px;height:692px;border-radius:44px;background:#111;padding:12px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
        iframe{width:332px;height:692px;border:0;border-radius:34px;background:#fff}
        .t{position:absolute;left:560px;top:70px;color:#fff;font-weight:800;font-size:40px;line-height:1.1;max-width:620px}
        .t small{display:block;font-size:20px;font-weight:600;opacity:.75;margin-bottom:10px;letter-spacing:.12em}
      </style></head><body><div class="t"><small>SOLECOST MOBİL</small>${mod.title}</div>
      <div class="ph"><iframe id="app" src="${url}"></iframe></div></body></html>`);
      await p.evaluate(OVERLAY);
      await p.addStyleTag({ content: `#__cap{left:auto!important;right:60px!important;bottom:auto!important;top:240px!important;transform:none!important;max-width:600px!important;font-size:26px!important;padding:20px 26px!important}#__cur{display:none!important}` });
      await wait(3000);
      return p.frameLocator('#app');
    },
    /** Başka bir oturumla (portal, alıcı firma) devam etmek için: çerezleri değiştirir */
    loginAs: async who => {
      const s = await state(who);
      await ctx.clearCookies(); await ctx.addCookies(s.cookies);
    },
  };

  try {
    await h.card(mod.kicker ?? 'Kullanım rehberi', mod.title, mod.summary, 'solecost.com');
    await mod.run(h);
    await h.card('Özet', mod.title, mod.recap ?? mod.summary, 'Sorularınız için: solecost.com/destek', 4000);
    await p.close(); await ctx.close();
  } catch (e) {
    await p.screenshot({ path: join(outDir, `_hata_${mod.slug}.png`) }).catch(() => {});
    throw e;
  } finally {
    await browser.close();
  }

  const webm = readdirSync(tmp).find(f => f.endsWith('.webm'));
  const raw = join(tmp, webm);
  const out = join(outDir, `${mod.slug}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw,
    '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', out]);
  rmSync(tmp, { recursive: true, force: true });
  return out;
}
