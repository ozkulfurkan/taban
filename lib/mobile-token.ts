import { encode } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth-options';
import { MOBILE_TOKEN_MAX_AGE } from '@/lib/mobile-auth';

// Mobil oturum token'ı: authorize ile doğrulanmış kullanıcıdan NextAuth JWT'si üretir
// (giriş ve şifre değiştirme sonrası yenileme aynı yolu kullanır).
export async function issueMobileToken(user: any) {
  const token = await authOptions.callbacks!.jwt!({
    token: { sub: user.id, name: user.name, email: user.email },
    user,
    account: null,
  } as any);
  const jwt = await encode({ token, secret: process.env.NEXTAUTH_SECRET!, maxAge: MOBILE_TOKEN_MAX_AGE });
  return { jwt, token, expiresAt: new Date(Date.now() + MOBILE_TOKEN_MAX_AGE * 1000).toISOString() };
}
