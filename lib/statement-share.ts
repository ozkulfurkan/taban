import { randomBytes } from 'crypto';

export const newShareToken = () => randomBytes(32).toString('base64url');

export function shareUrl(token: string) {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/ekstre/${token}`;
}

// Token biçimi: 43 karakter base64url. Biçime uymayan istek veritabanına gitmez.
export const isTokenShaped = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);
