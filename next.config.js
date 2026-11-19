/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // Genel güvenlik başlıkları: tür tahmini (MIME sniffing) kapalı, başka sitelerin
  // çerçevesine gömülme (clickjacking) yok, adres bilgisi dışarıya gitmez.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      ],
    }, {
      // Paylaşılan ekstre linki token içerir: adres hiçbir yere gönderilmez
      source: '/ekstre/:path*',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    }];
  },
};

module.exports = nextConfig;