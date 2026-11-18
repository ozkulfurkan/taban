import { prisma } from '@/lib/prisma';

// Veritabanı tabanlı deneme sınırı: Vercel'de istekler farklı sunuculara gittiği için
// bellekte tutulan sayaç işe yaramaz.

const WINDOW_MS = 15 * 60 * 1000;

export const LIMITS = {
  loginPerAccount: 5,   // aynı e-posta için 15 dakikada 5 hatalı deneme
  loginPerIp: 30,       // aynı IP'den 15 dakikada 30 hatalı deneme
  resetPerAccount: 3,   // aynı e-posta için 15 dakikada 3 şifre sıfırlama e-postası
  resetPerIp: 10,
};

export function clientIp(headers: Headers | Record<string, any> | undefined): string {
  const get = (k: string) =>
    headers instanceof Headers ? headers.get(k) : (headers?.[k] as string | undefined);
  const fwd = get('x-forwarded-for');
  return (fwd ? String(fwd).split(',')[0].trim() : get('x-real-ip')) || 'unknown';
}

export const normEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();

// Sayaç tablosuna ulaşılamazsa (örn. migration henüz uygulanmadıysa) giriş engellenmez,
// sadece loglanır: deneme sınırı yüzünden kimsenin dışarıda kalmaması tercih edildi.
function warn(error: unknown) {
  console.error('login-throttle unavailable:', (error as Error)?.message ?? error);
}

async function countRecent(key: string) {
  return prisma.loginAttempt.count({
    where: { key, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
}

export async function isLimited(key: string, limit: number) {
  try {
    return (await countRecent(key)) >= limit;
  } catch (error) {
    warn(error);
    return false;
  }
}

export async function recordAttempt(...keys: string[]) {
  try {
    await prisma.loginAttempt.createMany({ data: keys.map(key => ({ key })) });
  } catch (error) {
    warn(error);
    return;
  }
  // Eski kayıtları ara sıra temizle
  if (Math.random() < 0.02) {
    await prisma.loginAttempt
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => {});
  }
}

export async function clearAttempts(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { key } }).catch(warn);
}
