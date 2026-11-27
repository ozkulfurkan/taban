/** @type {import('next').NextConfig} */

// İçerik güvenliği politikası (CSP): sayfa yalnız kendi sunucusundan betik, stil, görsel ve veri yükler;
// başka sitelere gömülemez, form başka adrese gönderilemez, eklenti (object) çalışmaz.
// Barkod etiketi yazdırma penceresi JsBarcode'u cdn.jsdelivr.net'ten yükler.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // Sunucu sürümü bilgisi yanıtta gösterilmez
  poweredByHeader: false,
  // HTTPS zorunlu: düz HTTP ile gelen istek kalıcı olarak HTTPS'e yönlendirilir (Vercel önünde x-forwarded-proto)
  async redirects() {
    if (!isProd) return [];
    return [{
      source: '/:path*',
      has: [
        { type: 'header', key: 'x-forwarded-proto', value: 'http' },
        { type: 'host', value: '(?<host>(?!localhost$)[^:]+)' },
      ],
      destination: 'https://:host/:path*',
      permanent: true,
    }];
  },
  // Güvenlik başlıkları: tür tahmini (MIME sniffing) kapalı, başka sitelerin çerçevesine gömülme (clickjacking) yok,
  // adres bilgisi dışarıya gitmez, tarayıcı siteye yalnız HTTPS ile bağlanır (HSTS), içerik güvenliği politikası (CSP).
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
    ];
    const prodOnly = isProd ? [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy', value: CSP },
    ] : [];
    return [{
      source: '/:path*',
      headers: [...common, ...prodOnly],
    }, {
      // Paylaşılan ekstre linki token içerir: adres hiçbir yere gönderilmez
      source: '/ekstre/:path*',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    }];
  },
};

module.exports = nextConfig;
