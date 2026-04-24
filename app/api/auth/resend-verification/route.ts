export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: true }); // silent — don't reveal existence
    if (user.emailVerified) return NextResponse.json({ error: 'already_verified' }, { status: 400 });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken: token } });

    const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'SoleCost - E-posta adresinizi doğrulayın',
      html: `
        <p>Merhaba ${user.name ?? user.email},</p>
        <p>Hesabınızı aktifleştirmek için e-posta adresinizi doğrulamanız gerekmektedir.</p>
        <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">E-postamı Doğrula</a></p>
        <p>Butona tıklayamıyorsanız şu bağlantıyı kopyalayın: ${verifyUrl}</p>
        <p>Bu e-posta, SoleCost hesabınız için otomatik olarak gönderildi.</p>
      `,
      text: `Merhaba ${user.name ?? user.email},\n\nHesabınızı doğrulamak için şu bağlantıya tıklayın:\n${verifyUrl}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Resend verification error:', err);
    return NextResponse.json({ error: 'Mail gönderilemedi' }, { status: 500 });
  }
}
