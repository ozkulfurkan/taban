import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isExpoToken } from '@/lib/push';

// Mobil uygulamanın bildirim token'ını oturumdaki hesaba bağlar (firma kullanıcısı ya da portal müşterisi).
// Token benzersizdir: cihazda başka hesapla giriş yapılınca kayıt yeni hesaba taşınır, eski hesaba bildirim gitmez.

async function owner() {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  return u.type === 'portal' ? { userId: null, portalCustomerId: u.id as string } : { userId: u.id as string, portalCustomerId: null };
}

export async function POST(req: NextRequest) {
  const who = await owner();
  if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isExpoToken(body?.token)) return NextResponse.json({ error: 'Geçersiz bildirim anahtarı' }, { status: 400 });
  const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;
  await prisma.pushToken.upsert({
    where: { token: body.token },
    create: { token: body.token, platform, ...who },
    update: { platform, ...who },
  });
  return NextResponse.json({ ok: true });
}

// Çıkışta: yalnızca bu hesaba bağlı token silinir
export async function DELETE(req: NextRequest) {
  const who = await owner();
  if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isExpoToken(body?.token)) return NextResponse.json({ error: 'Geçersiz bildirim anahtarı' }, { status: 400 });
  await prisma.pushToken.deleteMany({
    where: { token: body.token, ...(who.userId ? { userId: who.userId } : { portalCustomerId: who.portalCustomerId }) },
  });
  return NextResponse.json({ ok: true });
}
