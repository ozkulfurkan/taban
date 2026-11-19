export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { decode, encode } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth-options';
import { bearerToken, MOBILE_TOKEN_MAX_AGE } from '@/lib/mobile-auth';

// Mobil oturum anahtarını yeniler. Token'daki abonelik bitişi (subUntil) satın alma / yenileme sonrası
// eskide kalır; uygulama abone olunca ya da 402 alınca bunu çağırıp güncel token alır.
// jwt callback her istekteki doğrulamayı yapar (kullanıcı silinmiş, rol/firma değişmişse 401).
export async function POST(req: NextRequest) {
  const raw = bearerToken(req.headers.get('authorization'));
  const secret = process.env.NEXTAUTH_SECRET!;
  const current = raw ? await decode({ token: raw, secret }).catch(() => null) : null;
  if (!current?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let token;
  try {
    token = await authOptions.callbacks!.jwt!({ token: current, account: null } as any);
  } catch {
    return NextResponse.json({ error: 'Oturum geçersiz, yeniden giriş yapın' }, { status: 401 });
  }
  const jwt = await encode({ token, secret, maxAge: MOBILE_TOKEN_MAX_AGE });
  return NextResponse.json({
    token: jwt,
    expiresAt: new Date(Date.now() + MOBILE_TOKEN_MAX_AGE * 1000).toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
