// Kullanıcının yüklediği dosyaları güvenli sunmak için başlıklar.
// Yükleyenin bildirdiği dosya türüne güvenilmez: yalnızca bilinen resim türleri tarayıcıda açılır,
// diğer her şey (HTML, SVG, PDF…) indirilir. Böylece yüklenen bir dosya uygulamanın kendi
// adresinde betik çalıştıramaz (ör. destek ekini açan yöneticinin oturumunu ele geçiremez).

const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** Dosya adını Content-Disposition için güvenli hale getirir (RFC 6266 / 5987) */
export function contentDisposition(kind: 'inline' | 'attachment', name: string) {
  const clean = (name || 'dosya').replace(/[\r\n"\\]/g, '_').slice(0, 200);
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

export function attachmentHeaders(name: string, mimeType: string | null | undefined): Record<string, string> {
  const type = (mimeType || '').toLowerCase().split(';')[0].trim();
  const inline = INLINE_TYPES.has(type);
  return {
    'Content-Type': inline ? type : 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', name),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, max-age=3600',
  };
}
