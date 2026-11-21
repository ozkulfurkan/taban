export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { choiceOf, matchPortalAccounts } from '@/lib/portal-login';

// Girişte firma seçimi: e-posta + şifreye uyan aktif portal hesaplarını firma adlarıyla döner.
// Deneme sınırı girişle ortaktır; yanlış şifrede hiçbir bilgi dönmez.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
  try {
    const matches = await matchPortalAccounts(email, password, { headers: Object.fromEntries(req.headers) });
    return NextResponse.json({ accounts: matches.filter(m => m.isActive).map(choiceOf) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const code = (e as Error).message;
    if (code === 'TOO_MANY_ATTEMPTS') return NextResponse.json({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' }, { status: 429 });
    return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 });
  }
}
