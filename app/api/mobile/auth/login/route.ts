import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { authOptions, authorizeStaff, authorizePortalCustomer } from '@/lib/auth-options';
import { MOBILE_TOKEN_MAX_AGE } from '@/lib/mobile-auth';

// Mobil giriş: web girişiyle aynı doğrulama (deneme sınırı, e-posta doğrulaması, portal ayrımı).
// Dönen token "Authorization: Bearer" başlığıyla kullanılır.

const ERRORS: Record<string, [number, string]> = {
  INVALID_CREDENTIALS: [401, 'E-posta veya şifre hatalı'],
  TOO_MANY_ATTEMPTS: [429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.'],
  EMAIL_NOT_VERIFIED: [403, 'E-posta adresiniz doğrulanmamış. Gelen kutunuza doğrulama bağlantısı gönderdik.'],
  ACCOUNT_INACTIVE: [403, 'Hesabınız pasif. Firma ile iletişime geçin.'],
};

const fail = (code: string) => {
  const [status, error] = ERRORS[code] ?? [401, ERRORS.INVALID_CREDENTIALS[1]];
  return NextResponse.json({ error, code }, { status });
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const kind = body.kind === 'portal' ? 'portal' : 'staff';
  if (!email || !password) return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });

  let user: any;
  try {
    const authorize = kind === 'portal' ? authorizePortalCustomer : authorizeStaff;
    user = await authorize({ email, password }, { headers: Object.fromEntries(req.headers) });
  } catch (e) {
    return fail((e as Error).message);
  }
  if (!user) return fail('INVALID_CREDENTIALS');

  const token = await authOptions.callbacks!.jwt!({
    token: { sub: user.id, name: user.name, email: user.email },
    user,
    account: null,
  } as any);
  const secret = process.env.NEXTAUTH_SECRET!;
  const jwt = await encode({ token, secret, maxAge: MOBILE_TOKEN_MAX_AGE });

  return NextResponse.json({
    token: jwt,
    expiresAt: new Date(Date.now() + MOBILE_TOKEN_MAX_AGE * 1000).toISOString(),
    user: publicUser(token),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

function publicUser(t: any) {
  if (t.type === 'portal') {
    return { id: t.sub, name: t.name, email: t.email, type: 'portal', portalType: t.portalType ?? 'CUSTOMER' };
  }
  return {
    id: t.sub, name: t.name, email: t.email, type: 'staff', role: t.role,
    companyName: t.companyName ?? null, companyType: t.companyType, allowedPages: t.allowedPages ?? [],
    language: t.language ?? 'tr', currency: t.currency ?? 'TRY',
  };
}
