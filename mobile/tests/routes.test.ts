import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Firma (app) ve portal (portal) grupları aynı adresi kullanamaz: expo-router adresi tek ekrana
// çözer; portal kullanıcısı firma ekranına yönlenir ve geçiş sessizce reddedilir (H-1).

const APP_DIR = join(__dirname, '..', 'src', 'app');

function routes(group: string): Set<string> {
  const root = join(APP_DIR, group);
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.tsx?$/.test(name) || name.startsWith('_layout')) continue;
      const rel = relative(root, full).replace(/\\/g, '/').replace(/\.(web\.)?tsx?$/, '').replace(/(^|\/)index$/, '');
      out.add(rel);
    }
  };
  walk(root);
  return out;
}

test('firma ve portal ekranları aynı adresi paylaşmaz', () => {
  const app = routes('(app)');
  const portal = routes('(portal)');
  const shared = [...portal].filter(r => app.has(r));
  assert.deepEqual(shared, [], `Çakışan adres(ler): ${shared.join(', ')} — portal ekranına "portal-" öneki verin`);
  assert.ok(app.size > 10 && portal.size > 3, 'ekranlar okunamadı');
});
