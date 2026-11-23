// Tanıtım videosu üretici: compose.html'i kare kare çizer, ffmpeg ile MP4'e çevirir.
// Kullanım:
//   node tools/promo-video/render.mjs                 → tüm konseptler, kare + story
//   node tools/promo-video/render.mjs maliyet story   → tek konsept, tek format
//   PREVIEW=1 node tools/promo-video/render.mjs ...   → video yerine her saniyeden bir kare (hızlı kontrol)
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const FPS = 30;
mkdirSync(OUT, { recursive: true });

const all = readdirSync(join(HERE, 'concepts')).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, ''));
const concepts = process.argv[2] ? [process.argv[2]] : all;
const formats = process.argv[3] ? [process.argv[3]] : ['story', 'square'];
const preview = process.env.PREVIEW === '1';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
try {
  for (const concept of concepts) {
    for (const format of formats) {
      const [w, h] = format === 'square' ? [1080, 1080] : [1080, 1920];
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const url = pathToFileURL(join(HERE, 'compose.html')).href + `?concept=${concept}&format=${format}`;
      await page.goto(url);
      const duration = await page.evaluate(() => window.__ready);
      const frames = Math.round(duration * FPS);
      const base = join(OUT, `solecost-${concept}-${format}`);

      if (preview) {
        for (let s = 0; s < duration; s += 1) {
          await page.evaluate(t => window.__seek(t), s + 0.5);
          await page.screenshot({ path: `${base}-t${String(s).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 });
        }
        console.log(`önizleme: ${concept}/${format} (${duration.toFixed(1)} sn)`);
        await page.close();
        continue;
      }

      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', `${base}.mp4`],
        { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
      for (let i = 0; i < frames; i++) {
        await page.evaluate(t => window.__seek(t), i / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
      await done;
      // Kapak karesi: başlığın tam göründüğü an
      await page.evaluate(t => window.__seek(t), Math.min(2.2, duration / 2));
      await page.screenshot({ path: `${base}-kapak.png` });
      console.log(`✓ ${base}.mp4 (${duration.toFixed(1)} sn, ${frames} kare)`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
