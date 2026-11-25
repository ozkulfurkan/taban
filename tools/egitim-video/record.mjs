// Kullanım: node tools/egitim-video/record.mjs [slug,slug...]   (boşsa hepsi)
// Çıktı: tools/egitim-video/out/<slug>.mp4
import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { record } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2]?.split(',').filter(Boolean);
const files = readdirSync(join(HERE, 'modules')).filter(f => f.endsWith('.mjs')).sort();
for (const f of files) {
  const mod = (await import(pathToFileURL(join(HERE, 'modules', f)).href)).default;
  if (only && !only.includes(mod.slug)) continue;
  const t = Date.now();
  try {
    const out = await record(mod, join(HERE, 'out'));
    console.log(`✓ ${mod.slug} → ${out} (${Math.round((Date.now() - t) / 1000)} sn)`);
  } catch (e) {
    console.error(`✘ ${mod.slug}: ${e.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
}
