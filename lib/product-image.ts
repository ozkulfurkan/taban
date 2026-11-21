// Ürün fotoğrafı: cihazda küçültülüp base64 gönderilir. Tür içerikten (imza baytları) doğrulanır,
// istemcinin bildirdiği türe güvenilmez.

export const MAX_IMAGE_BYTES = 1_500_000;
/** Firma logosu her katalog/ekstre yanıtında taşınır: daha küçük tutulur */
export const MAX_LOGO_BYTES = 1_000_000;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const ascii = (buf: Uint8Array, from: number, to: number) => String.fromCharCode(...Array.from(buf.slice(from, to)));

export function sniffImage(buf: Uint8Array): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** "data:image/jpeg;base64,..." ya da düz base64 → bayt + tür; geçersizse hata mesajı */
export function decodeImage(input: unknown, maxBytes = MAX_IMAGE_BYTES): { bytes: Buffer; mime: ImageMime } | { error: string } {
  if (typeof input !== 'string' || !input) return { error: 'Fotoğraf verisi yok' };
  const b64 = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return { error: 'Fotoğraf verisi okunamadı' };
  const bytes = Buffer.from(b64, 'base64');
  if (!bytes.length) return { error: 'Fotoğraf verisi okunamadı' };
  if (bytes.length > maxBytes) return { error: `Fotoğraf çok büyük (en fazla ${(maxBytes / 1_000_000).toLocaleString('tr-TR')} MB)` };
  const mime = sniffImage(bytes);
  if (!mime) return { error: 'Yalnızca JPEG, PNG ya da WebP fotoğraf yüklenebilir' };
  return { bytes, mime };
}

export const toDataUrl = (mime: string, data: Uint8Array) => `data:${mime};base64,${Buffer.from(data).toString('base64')}`;
