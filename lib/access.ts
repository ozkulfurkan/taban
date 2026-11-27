// Erişim kuralları: middleware (edge), menü ve API'ler aynı kaynağı kullanır.
// Burada veritabanı erişimi yoktur; oturumdaki bilgilerin güncelliği
// lib/auth-options.ts içindeki jwt callback'inde her istekte doğrulanır.

export type AccessUser = {
  type?: string;
  role?: string;
  allowedPages?: string[];
  portalType?: string;
};

// Sayfa yolu öneki → izin anahtarı (birden fazlaysa herhangi biri yeter). Listede olmayan sayfalar herkese açıktır.
export const PAGE_KEYS: Array<[string, string | string[]]> = [
  ['/dashboard', 'dashboard'],
  ['/customers', 'customers'],
  ['/suppliers', 'suppliers'],
  // Verilen (hammadde) siparişleri: tedarikçi izni ya da yalnız "Hammadde siparişi ver" izni
  ['/verilen-siparisler', ['suppliers', 'material-orders']],
  ['/invoices', 'invoices'],
  ['/payments', 'payments'],
  ['/products', 'products'],
  ['/materials', 'materials'],
  ['/accounts', 'accounts'],
  ['/cek-portfolyo', 'cek-portfolyo'],
  ['/calculations', 'calculations'],
  ['/settings', 'settings'],
  ['/subcontractors', 'fason'],
  ['/subcontractor-orders', 'fason'],
  ['/personnel', 'personnel'],
  // Gelen siparişler: tam izin ya da salt okunur görüntüleme (usta)
  ['/orders', ['orders', 'orders-view']],
  ['/sevkiyat', 'sevkiyat'],
];

// API öneki → izin anahtarı. Sadece hassas ve başka modüllerin
// ortak kullanmadığı API'ler sayfa iznine bağlanır (örn. personel maaşları).
const API_PAGE_KEYS: Array<[string, string | string[]]> = [
  ['/api/personnel', 'personnel'],
  // Fason: sipariş, zimmet ve fasoncu ayrıntısı (liste ucu alış/hammadde ekranlarında da kullanılır)
  ['/api/subcontractor-orders', 'fason'],
  ['/api/subcontractors/', 'fason'],
  ['/api/dashboard', 'dashboard'],
  // Gelen siparişler ve portal sipariş yönetimi
  ['/api/orders', ['orders', 'orders-view']],
  ['/api/portal/orders', 'orders'],
  ['/api/portal/catalog', 'orders'],
  // Sevk fişi: Sevkiyat ekranı (nakliyeci) ve sipariş detayındaki sevkiyat (Siparişler izni)
  ['/api/dispatches', ['sevkiyat', 'orders']],
];

// Portal kullanıcılarının (müşteri / fasoncu) erişebileceği API'ler.
const PORTAL_API_PREFIXES = [
  '/api/auth/',
  '/api/portal/me/',
  '/api/mobile/auth/', // mobil uygulama oturum bilgisi
  '/api/mobile/push-token', // kendi cihazının bildirim kaydı
  '/api/portal/fason/',
  '/api/portal/auth/verify-email',
  '/api/account/password', // kendi şifresini değiştirme (web ve mobil portal)
  '/api/exchange-rates', // genel kur bilgisi, firma verisi içermez
  '/api/notifications', // kendi bildirim kutusu
];

// VIEWER rolünün yazma yapabileceği API'ler (kendi profili, destek talepleri).
const VIEWER_WRITE_ALLOWED = ['/api/auth/', '/api/settings', '/api/support/', '/api/mobile/push-token', '/api/account/deletion', '/api/notifications'];

// Düzenleyicinin silebileceği API'ler (kendi oturumu, kendi destek talepleri).
// Ekstre linkini kapatmak kayıt silmek değildir; düzenleyici de linki yenileyip kapatabilir.
const EDITOR_DELETE_ALLOWED = ['/api/auth/', '/api/support/', '/api/statement-links', '/api/mobile/push-token'];

export const ASSIGNABLE_ROLES = ['COMPANY_OWNER', 'EDITOR', 'VIEWER'] as const;

function matchPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');
}

export function hasFullAccess(user: AccessUser | null | undefined) {
  return user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER';
}

export function pageKeyFor(pathname: string): string | null {
  const hit = PAGE_KEYS.find(([prefix]) => matchPrefix(pathname, prefix));
  return hit ? (Array.isArray(hit[1]) ? hit[1][0] : hit[1]) : null;
}

function pageKeysFor(pathname: string): string[] | null {
  const hit = PAGE_KEYS.find(([prefix]) => matchPrefix(pathname, prefix));
  return hit ? (Array.isArray(hit[1]) ? hit[1] : [hit[1]]) : null;
}

/**
 * Kısıtlı profil: yalnız "Gelen siparişleri görüntüle", "Hammadde siparişi ver" ve/veya "Sevkiyat" izni olan
 * personel (usta, nakliyeci). Bu kullanıcılar yalnız aşağıdaki sayfa ve API'lere girer; fiyat, cari ve kasa
 * bilgisi taşıyan diğer uçlar (satışlar, ödemeler, cari detay…) kapalıdır.
 */
export const RESTRICTED_KEYS = ['orders-view', 'material-orders', 'sevkiyat'] as const;
export function isRestricted(user: AccessUser | null | undefined) {
  const pages = user?.allowedPages ?? [];
  return !!user && user.type !== 'portal' && !hasFullAccess(user) && pages.length > 0
    && pages.every(p => (RESTRICTED_KEYS as readonly string[]).includes(p));
}
// Kısıtlı profilin her durumda girebileceği sayfalar
const RESTRICTED_OPEN_PAGES = ['/yetkisiz', '/bildirimler', '/destek-merkezi'];
// Kısıtlı profilin API'leri: herkes için olanlar + izne göre
const RESTRICTED_OPEN_API = ['/api/auth/', '/api/notifications', '/api/account/', '/api/mobile/', '/api/exchange-rates', '/api/support/', '/api/tcmb-rates'];
const RESTRICTED_API_BY_KEY: Record<string, Array<{ prefix: string; read?: boolean; exact?: boolean; query?: [string, string] }>> = {
  'orders-view': [
    { prefix: '/api/orders', read: true }, { prefix: '/api/koli', read: true },
    { prefix: '/api/customers', read: true, exact: true, query: ['minimal', 'true'] },
  ],
  'material-orders': [{ prefix: '/api/network/' }],
  sevkiyat: [
    { prefix: '/api/dispatches' }, { prefix: '/api/print-settings', read: true },
    // Sevk formu: yalnız müşteri adları (bakiye yok) ve ürün listesi
    { prefix: '/api/customers', read: true, exact: true, query: ['minimal', 'true'] },
    { prefix: '/api/products', read: true, exact: true }, { prefix: '/api/company', read: true, exact: true },
  ],
};
/** İlk açılış sayfası: Ana Sayfa izni yoksa izinli ilk sayfa */
export function homePathFor(user: AccessUser | null | undefined): string {
  if (!user || hasFullAccess(user)) return '/dashboard';
  const pages = user.allowedPages ?? [];
  if (pages.includes('dashboard')) return '/dashboard';
  if (pages.includes('orders') || pages.includes('orders-view')) return '/orders';
  if (pages.includes('material-orders')) return '/verilen-siparisler';
  if (pages.includes('sevkiyat')) return '/sevkiyat';
  return '/dashboard';
}
/** Gelen siparişlerde değişiklik yapabilir mi (salt okunur "orders-view" değil) */
export function canEditOrders(user: AccessUser | null | undefined) {
  return hasFullAccess(user) || (user?.allowedPages ?? []).includes('orders');
}

// Sadece platform yöneticisinin (ADMIN) görebileceği sayfalar
const ADMIN_ONLY_PAGES = ['/admin', '/logs'];

export function canSeePage(user: AccessUser | null | undefined, pathname: string) {
  if (!user || user.type === 'portal') return false;
  if (ADMIN_ONLY_PAGES.some(p => matchPrefix(pathname, p))) return user.role === 'ADMIN';
  if (hasFullAccess(user)) return true;
  const keys = pageKeysFor(pathname);
  if (isRestricted(user)) {
    if (RESTRICTED_OPEN_PAGES.some(p => matchPrefix(pathname, p))) return true;
    return !!keys && keys.some(k => (user.allowedPages ?? []).includes(k));
  }
  if (!keys) return true;
  return keys.some(k => (user.allowedPages ?? []).includes(k));
}

export type ApiDecision = { ok: true } | { ok: false; status: 401 | 403; error: string };

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Oturum açmış kullanıcının bir API isteğine izni var mı?
// Oturumsuz istekler route'lara bırakılır (giriş, kayıt, cron gibi açık uç noktalar var).
export function checkApiAccess(user: AccessUser | null | undefined, method: string, pathname: string, search?: URLSearchParams): ApiDecision {
  if (!user) return { ok: true };

  if (user.type === 'portal') {
    // Fasoncu portalı müşteri portalı uçlarını, müşteri portalı fason uçlarını kullanamaz
    if (user.portalType === 'SUBCONTRACTOR' && pathname.startsWith('/api/portal/me/')) return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok' };
    if (user.portalType !== 'SUBCONTRACTOR' && pathname.startsWith('/api/portal/fason/')) return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok' };
    if (PORTAL_API_PREFIXES.some(p => pathname.startsWith(p))) return { ok: true };
    return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok' };
  }

  if (!READ_METHODS.has(method.toUpperCase()) && user.role === 'VIEWER') {
    if (!VIEWER_WRITE_ALLOWED.some(p => matchPrefix(pathname, p.replace(/\/$/, '')) || pathname.startsWith(p))) {
      return { ok: false, status: 403, error: 'Görüntüleyici rolüyle kayıt eklenemez veya değiştirilemez' };
    }
  }

  // Düzenleyici (EDITOR) kayıt ekleyip değiştirebilir ama silemez
  if (method.toUpperCase() === 'DELETE' && user.role === 'EDITOR' && !EDITOR_DELETE_ALLOWED.some(p => pathname.startsWith(p))) {
    return { ok: false, status: 403, error: 'Düzenleyici rolüyle kayıt silinemez. Firma yöneticinizden yardım isteyin.' };
  }

  if (isRestricted(user)) {
    if (RESTRICTED_OPEN_API.some(p => matchPrefix(pathname, p.replace(/\/$/, '')) || pathname.startsWith(p))) return { ok: true };
    const read = READ_METHODS.has(method.toUpperCase());
    const ok = (user.allowedPages ?? []).some(k => (RESTRICTED_API_BY_KEY[k] ?? []).some(r =>
      (r.exact ? pathname === r.prefix : matchPrefix(pathname, r.prefix.replace(/\/$/, '')) || pathname.startsWith(r.prefix))
      && (read || !r.read) && (!r.query || search?.get(r.query[0]) === r.query[1])));
    return ok ? { ok: true } : { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok' };
  }

  if (!hasFullAccess(user)) {
    // Gelen siparişler salt okunur izinle (orders-view) yalnız görüntülenir
    if (matchPrefix(pathname, '/api/orders') && !READ_METHODS.has(method.toUpperCase()) && !canEditOrders(user)) {
      return { ok: false, status: 403, error: 'Siparişleri yalnız görüntüleme yetkiniz var' };
    }
    const hit = API_PAGE_KEYS.find(([prefix]) => matchPrefix(pathname, prefix));
    const need = hit ? (Array.isArray(hit[1]) ? hit[1] : [hit[1]]) : [];
    if (hit && !need.some(k => (user.allowedPages ?? []).includes(k))) {
      return { ok: false, status: 403, error: 'Bu sayfaya erişim yetkiniz yok' };
    }
  }

  return { ok: true };
}

// Firma sahibi sadece firma içi rolleri atayabilir; platform yöneticisi (ADMIN)
// rolünü sadece mevcut bir ADMIN verebilir.
export function canAssignRole(actorRole: string | undefined, role: unknown): boolean {
  if (typeof role !== 'string') return false;
  if (role === 'ADMIN') return actorRole === 'ADMIN';
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}
