// "Müşterini davet et" mesajı: uygulama indirme bağlantısı (iPhone'da App Store'a yönlendirir)
// ve web portalı girişi. Saf fonksiyon: test edilebilir.

// Saf modül (test edilebilir): web adresi çağıran tarafından verilir (config.WEB_URL).
export const inviteUrl = (webUrl: string) => `${webUrl}/indir`;
export const portalLoginUrl = (webUrl: string) => `${webUrl}/portal/login`;

export function inviteMessage(webUrl: string, o: { companyName?: string | null; customerName?: string | null; portalEmail?: string | null }) {
  const lines = [
    o.customerName ? `Merhaba ${o.customerName},` : 'Merhaba,',
    `${o.companyName ? `${o.companyName} olarak` : 'Firmamız olarak'} siparişlerimizi ve cari hesabımızı SoleCost üzerinden takip ediyoruz.`,
    'Siparişlerinizi verebilir, durumunu anlık izleyebilir, ekstrenizi ve kataloğumuzu görebilirsiniz.',
    '',
    `📱 Uygulama: ${inviteUrl(webUrl)}`,
    `💻 Web'den giriş: ${portalLoginUrl(webUrl)}`,
  ];
  if (o.portalEmail) lines.push('', `Giriş e-postanız: ${o.portalEmail}`, 'Şifrenizi sizinle ayrıca paylaşacağız.');
  return lines.join('\n');
}
