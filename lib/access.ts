// Erişim kuralları: middleware (edge), menü ve API'ler aynı kaynağı kullanır.
// Burada veritabanı erişimi yoktur; oturumdaki bilgilerin güncelliği
// lib/auth-options.ts içindeki jwt callback'inde her istekte doğrulanır.

export type AccessUser = {
  type?: string;
  role?: string;
  allowedPages?: string[];
  portalType?: string;
};

// Sayfa yolu öneki → izin anahtarı. Listede olmayan sayfalar herkese açıktır.
export const PAGE_KEYS: Array<[string, string]> = [
  ['/dashboard', 'dashboard'],
  ['/customers', 'customers'],
  ['/suppliers', 'suppliers'],
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
  ['/orders', 'orders'],
];

// API öneki → izin anahtarı. Sadece hassas ve başka modüllerin
// ortak kullanmadığı API'ler sayfa iznine bağlanır (örn. personel maaşları).
const API_PAGE_KEYS: Array<[string, string]> = [
  ['/api/personnel', 'personnel'],
  ['/api/dashboard', 'dashboard'],
];

// Portal kullanıcılarının (müşteri / fasoncu) erişebileceği API'ler.
const PORTAL_API_PREFIXES = [
  '/api/auth/',
  '/api/portal/me/',
  '/api/portal/fason/',
  '/api/portal/auth/verify-email',
  '/api/exchange-rates', // genel kur bilgisi, firma verisi içermez
];

// VIEWER rolünün yazma yapabileceği API'ler (kendi profili, destek talepleri).
const VIEWER_WRITE_ALLOWED = ['/api/auth/', '/api/settings', '/api/support/'];

export const ASSIGNABLE_ROLES = ['COMPANY_OWNER', 'EDITOR', 'VIEWER'] as const;

function matchPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');
}

export function hasFullAccess(user: AccessUser | null | undefined) {
  return user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER';
}

export function pageKeyFor(pathname: string): string | null {
  const hit = PAGE_KEYS.find(([prefix]) => matchPrefix(pathname, prefix));
  return hit ? hit[1] : null;
}

export function canSeePage(user: AccessUser | null | undefined, pathname: string) {
  if (!user || user.type === 'portal') return false;
  if (hasFullAccess(user)) return true;
  const key = pageKeyFor(pathname);
  if (!key) return true;
  return (user.allowedPages ?? []).includes(key);
}

export type ApiDecision = { ok: true } | { ok: false; status: 401 | 403; error: string };

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Oturum açmış kullanıcının bir API isteğine izni var mı?
// Oturumsuz istekler route'lara bırakılır (giriş, kayıt, cron gibi açık uç noktalar var).
export function checkApiAccess(user: AccessUser | null | undefined, method: string, pathname: string): ApiDecision {
  if (!user) return { ok: true };

  if (user.type === 'portal') {
    if (PORTAL_API_PREFIXES.some(p => pathname.startsWith(p))) return { ok: true };
    return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok' };
  }

  if (!READ_METHODS.has(method.toUpperCase()) && user.role === 'VIEWER') {
    if (!VIEWER_WRITE_ALLOWED.some(p => matchPrefix(pathname, p.replace(/\/$/, '')) || pathname.startsWith(p))) {
      return { ok: false, status: 403, error: 'Görüntüleyici rolüyle kayıt eklenemez veya değiştirilemez' };
    }
  }

  if (!hasFullAccess(user)) {
    const hit = API_PAGE_KEYS.find(([prefix]) => matchPrefix(pathname, prefix));
    if (hit && !(user.allowedPages ?? []).includes(hit[1])) {
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
