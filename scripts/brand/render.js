// Marka PNG'lerini üretir: node scripts/brand/render.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { BORDO, markSvg } = require('./mark');

const root = path.resolve(__dirname, '../..');
const img = p => path.join(root, 'mobile/assets/images', p);

const outputs = [
  // [dosya, piksel, svg seçenekleri, şeffaf zemin]
  [img('icon.png'), 1024, { bg: BORDO }, false],
  [img('favicon.png'), 48, { bg: BORDO, scale: 1.12 }, false],
  [img('android-icon-background.png'), 512, { bg: BORDO, sole: BORDO, text: BORDO }, false],
  // Android uyarlanabilir simge: içerik ortadaki güvenli alanda (≈%66) kalmalı
  [img('android-icon-foreground.png'), 512, { bg: null, scale: 0.72 }, true],
  [img('android-icon-monochrome.png'), 432, { bg: null, cutout: true, scale: 0.72 }, true],
  [img('splash-icon.png'), 512, { bg: null }, true],
];

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  for (const [file, size, opts, transparent] of outputs) {
    const svg = markSvg(opts).replace('width="256" height="256"', `width="${size}" height="${size}"`);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('yazıldı', path.relative(root, file));
  }
  // Paylaşım görseli (1200×630): bağlantı önizlemelerinde görünür
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:${BORDO};display:flex;align-items:center;justify-content:center;gap:56px;font-family:Inter,'Helvetica Neue',Arial,sans-serif">
    <div style="width:220px;height:220px;border-radius:48px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35)">${markSvg({ bg: BORDO, scale: 1.12 }).replace('width="256" height="256"', 'width="220" height="220"')}</div>
    <div style="color:#fff"><div style="font-size:92px;font-weight:800;letter-spacing:1px">SoleCost</div>
    <div style="font-size:34px;opacity:.85;margin-top:8px">Taban üretiminde maliyet, cari ve sipariş</div></div></body></html>`);
  await page.screenshot({ path: path.join(root, 'public/og-image.png') });
  console.log('yazıldı public/og-image.png');
  fs.writeFileSync(path.join(root, 'public/favicon.svg'), markSvg({ bg: BORDO }) + '\n');
  console.log('yazıldı public/favicon.svg');
  await browser.close();
})();
