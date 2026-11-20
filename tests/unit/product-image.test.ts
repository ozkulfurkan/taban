import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeImage, sniffImage } from '../../lib/product-image';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('imza baytlarından tür', () => {
  assert.equal(sniffImage(jpeg), 'image/jpeg');
  assert.equal(sniffImage(png), 'image/png');
  assert.equal(sniffImage(Buffer.from('RIFF0000WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImage(Buffer.from('<svg></svg>')), null);
});

test('data URL ve düz base64 çözülür, bildirilen türe güvenilmez', () => {
  const r = decodeImage(`data:image/png;base64,${jpeg.toString('base64')}`);
  assert.ok(!('error' in r));
  assert.equal((r as { mime: string }).mime, 'image/jpeg');
  assert.ok(!('error' in decodeImage(png.toString('base64'))));
});

test('geçersiz ve büyük veriler reddedilir', () => {
  assert.ok('error' in decodeImage(null));
  assert.ok('error' in decodeImage(Buffer.from('<svg onload=alert(1)>').toString('base64')));
  assert.ok('error' in decodeImage('%%%'));
  const big = Buffer.concat([jpeg, Buffer.alloc(1_600_000)]);
  assert.ok('error' in decodeImage(big.toString('base64')));
});
