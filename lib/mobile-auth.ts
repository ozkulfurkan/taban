// Mobil uygulama oturumu: NextAuth'un imzaladığı JWT, çerez yerine
// "Authorization: Bearer <token>" başlığıyla gönderilir. Middleware bu başlığı
// NextAuth oturum çerezine çevirir; böylece mevcut route'lar değişmeden çalışır.

export const MOBILE_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 gün (web oturumuyla aynı)

export const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token'];

// JWE biçimi: beş base64url parça. Biçime uymayan başlık yok sayılır.
export function bearerToken(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*){4})$/);
  return m ? m[1] : null;
}

/** Bearer token varsa ve istekte oturum çerezi yoksa, çerez başlığına oturum çerezini ekler. */
export function withBearerCookie(headers: Headers): Headers | null {
  const token = bearerToken(headers.get('authorization'));
  if (!token) return null;
  const cookie = headers.get('cookie') || '';
  if (SESSION_COOKIES.some(n => cookie.includes(`${n}=`))) return null;
  const next = new Headers(headers);
  const add = SESSION_COOKIES.map(n => `${n}=${token}`).join('; ');
  next.set('cookie', cookie ? `${cookie}; ${add}` : add);
  return next;
}
