const { chromium } = require('playwright');
const [out, url, w, h, auth] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, baseURL: 'http://localhost:3001', locale: 'tr-TR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('whats_new_v20260510', '1'); } catch {} });
  const p = await ctx.newPage();
  if (auth === '1') { await p.goto('/login'); await p.fill('input[type=email]', 'test@solecost.com'); await p.fill('input[type=password]', 'Test123456'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 }); }
  await p.goto(url); await p.waitForTimeout(2500); await p.screenshot({ path: out, fullPage: process.env.FULL === '1' });
  await b.close();
})();
