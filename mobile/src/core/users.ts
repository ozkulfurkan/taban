// Firma kullanıcıları (mobil Ayarlar → Kullanıcılar). Sayfa izin anahtarları web ile aynı (lib/access.ts).
export type CompanyUser = { id: string; name: string | null; email: string; role: string; allowedPages: string[]; createdAt: string };

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Sistem yöneticisi', COMPANY_OWNER: 'Firma yöneticisi', EDITOR: 'Düzenleyici', VIEWER: 'Görüntüleyici',
};
export const ROLE_HINT: Record<string, string> = {
  COMPANY_OWNER: 'Her şeyi görür ve yönetir, kullanıcı ekler.',
  EDITOR: 'İzin verilen sayfalarda kayıt ekler ve düzenler, silemez.',
  VIEWER: 'İzin verilen sayfaları yalnızca görüntüler.',
};
export const ASSIGNABLE = ['EDITOR', 'VIEWER', 'COMPANY_OWNER'] as const;

export const PAGES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Ana sayfa ve raporlar' },
  { key: 'customers', label: 'Müşteriler' },
  { key: 'suppliers', label: 'Tedarikçiler' },
  { key: 'invoices', label: 'Satışlar' },
  { key: 'payments', label: 'Ödemeler' },
  { key: 'products', label: 'Ürünler' },
  { key: 'materials', label: 'Hammaddeler' },
  { key: 'accounts', label: 'Kasa ve banka' },
  { key: 'cek-portfolyo', label: 'Çekler' },
  { key: 'orders', label: 'Siparişler' },
  { key: 'orders-view', label: 'Siparişleri görüntüle (salt okunur)' },
  { key: 'material-orders', label: 'Hammadde siparişi ver' },
  { key: 'sevkiyat', label: 'Sevkiyat (sevk fişi)' },
  { key: 'personnel', label: 'Personel' },
  { key: 'fason', label: 'Fason' },
  { key: 'calculations', label: 'Maliyet hesaplama' },
  { key: 'settings', label: 'Ayarlar' },
];

export const fullAccess = (role: string) => role === 'ADMIN' || role === 'COMPANY_OWNER';
