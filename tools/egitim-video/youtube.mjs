// YouTube başlık/açıklama/etiketleri modül tanımlarından üretir: node tools/egitim-video/youtube.mjs > youtube.json
import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(join(HERE, 'modules')).filter(f => f.endsWith('.mjs')).sort();
const out = [];
for (const f of files) {
  const m = (await import(pathToFileURL(join(HERE, 'modules', f)).href)).default;
  const title = `SoleCost Kullanım Rehberi · ${m.title}`.slice(0, 100);
  const description = [
    `SoleCost kullanım rehberi: ${m.title}. Ekrandaki adım adım açıklamalarla kısa sürede öğrenin.`,
    '',
    'Bu videoda:',
    ...m.summary.map(s => `• ${s}`),
    '',
    'Kısaca:',
    ...(m.recap ?? m.summary).map(s => `• ${s}`),
    '',
    'SoleCost: ayakkabı ve taban sektörü için maliyet, cari, stok, sipariş ve çek takibi. Web ve mobil (iPhone / Android).',
    'Web: https://www.solecost.com',
    'Destek: https://www.solecost.com/destek',
  ].join('\n');
  out.push({
    slug: m.slug, file: `${m.slug}.mp4`, title, description,
    tags: ['SoleCost', 'kullanım rehberi', 'eğitim', 'ayakkabı', 'taban', 'ön muhasebe', 'cari takip', m.title],
  });
}
console.log(JSON.stringify(out, null, 2));
