import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'E-posta zorunlu' }, { status: 400 });

  // Always return success to avoid email enumeration
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, message: 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı oluşturuldu.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  // Since there's no email service, we return the token directly
  // In production, you'd send this via email instead
  const baseUrl = req.headers.get('origin') || '';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  return NextResponse.json({ ok: true, resetUrl, token });
}
