// Yasal metinlerde ve mağaza kayıtlarında kullanılan iletişim bilgileri.
// Vercel ortam değişkenleriyle doldurulur; boşsa ilgili satır gösterilmez.
export const LEGAL = {
  product: 'SoleCost',
  controller: process.env.NEXT_PUBLIC_LEGAL_ENTITY || '',   // veri sorumlusunun ticari unvanı
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || '',
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
  updatedAt: '18.11.2026',
};
