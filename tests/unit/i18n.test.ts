// Çeviri kapsamı: müşteri portalındaki her metnin İngilizce karşılığı olmalı,
// ana uygulamanın çeviri dosyasında iki dilin anahtarları aynı olmalı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PORTAL_EN } from '../../lib/i18n/portal';
import { translations } from '../../lib/i18n/translations';

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'fason' ? [] : walk(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

test('müşteri portalındaki her tp() metninin İngilizcesi var', () => {
  const missing: string[] = [];
  // Portal ve firma ağının ortak katalog ekranı da portal metinlerini kullanır
  // Portal ekranlarıyla ortak bileşenler çeviriyi t prop'u olarak alır: t('…') de taranır
  const shared = ['order-catalog.tsx', 'order-messages.tsx', 'shipment-list.tsx', 'shipment-qty.tsx'].map(f => path.join(process.cwd(), 'app/components', f));
  for (const file of [...walk(path.join(process.cwd(), 'app/portal')), ...shared]) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of Array.from(src.matchAll(/\bt[p]?\('((?:[^'\\]|\\.)*)'\)/g))) {
      const key = m[1].replace(/\\'/g, "'");
      if (!(key in PORTAL_EN)) missing.push(`${path.relative(process.cwd(), file)}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('Türkçe ve İngilizce çeviri anahtarları aynı', () => {
  const flat = (o: any, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  const tr = new Set(flat(translations.tr));
  const en = new Set(flat(translations.en));
  assert.deepEqual(Array.from(tr).filter(k => !en.has(k)), [], 'İngilizcede eksik');
  assert.deepEqual(Array.from(en).filter(k => !tr.has(k)), [], 'Türkçede eksik');
});
