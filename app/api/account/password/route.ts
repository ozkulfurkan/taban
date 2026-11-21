export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions, authorizePortalCustomer, authorizeStaff } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { passwordError } from '@/lib/password';
import { isLimited, recordAttempt, clearAttempts } from '@/lib/login-throttle';
import { bearerToken } from '@/lib/mobile-auth';
import { issueMobileToken } from '@/lib/mobile-token';

// Kendi şifresini değiştirme (personel ve portal kullanıcısı): mevcut şifre doğrulanır.
// Şifre değişince açık oturumların tamamı düşer (passwordChangedAt). Mobilden gelen istekte
// yeni token döner; web istemcisi yeni şifreyle yeniden oturum açar.

const LIMIT = 5; // 15 dakikada 5 hatalı mevcut şifre denemesi

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const next = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!current) return NextResponse.json({ error: 'Mevcut şifrenizi girin' }, { status: 400 });
  const rule = passwordError(next);
  if (rule) return NextResponse.json({ error: rule }, { status: 400 });
  if (next === current) return NextResponse.json({ error: 'Yeni şifre mevcut şifreyle aynı olamaz' }, { status: 400 });

  const portal = user.type === 'portal';
  const key = `pwchange:${portal ? 'p' : 'u'}:${user.id}`;
  if (await isLimited(key, LIMIT)) {
    return NextResponse.json({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' }, { status: 429 });
  }

  const row = portal
    ? await prisma.portalCustomer.findUnique({ where: { id: user.id }, select: { email: true, password: true } })
    : await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, password: true } });
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await bcrypt.compare(current, row.password))) {
    await recordAttempt(key);
    return NextResponse.json({ error: 'Mevcut şifre hatalı' }, { status: 400 });
  }
  await clearAttempts(key);

  const data = { password: await bcrypt.hash(next, 12), passwordChangedAt: new Date() };
  if (portal) await prisma.portalCustomer.update({ where: { id: user.id }, data });
  else await prisma.user.update({ where: { id: user.id }, data });

  // Mobil: oturum düşmesin diye yeni şifreyle yeni token
  let token: string | undefined;
  if (bearerToken(req.headers.get('authorization'))) {
    try {
      const fresh = portal
        ? await authorizePortalCustomer({ email: row.email, password: next }, { headers: Object.fromEntries(req.headers) })
        : await authorizeStaff({ email: row.email, password: next }, { headers: Object.fromEntries(req.headers) });
      if (fresh) token = (await issueMobileToken(fresh)).jwt;
    } catch { /* yeni token alınamazsa istemci yeniden giriş ister */ }
  }
  return NextResponse.json({ ok: true, ...(token ? { token } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}
