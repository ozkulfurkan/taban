export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, 'signup'), { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Çok fazla istek. ${rl.retryAfter} saniye sonra tekrar deneyin.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { email, password, name, companyName } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (!/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(password) || !/[0-9]/.test(password) || password.length < 6) {
      return NextResponse.json(
        { error: 'Şifre en az 6 karakter, 1 harf ve 1 rakam içermelidir.' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const trialEnd = new Date();
    trialEnd.setFullYear(trialEnd.getFullYear() + 1);

    const company = await prisma.company.create({
      data: {
        name: companyName || `${name || email}'s Company`,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: trialEnd,
      },
    });

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email?.split?.('@')?.[0] || 'User',
        role: 'COMPANY_OWNER',
        companyId: company.id,
        emailVerified: false,
        emailVerifyToken,
      },
    });

    // Create 3 default kasa accounts
    await prisma.account.createMany({
      data: [
        { companyId: company.id, name: 'TL Kasa', type: 'Kasa', currency: 'TRY', balance: 0, color: '#10B981' },
        { companyId: company.id, name: 'Dolar Kasa', type: 'Kasa', currency: 'USD', balance: 0, color: '#3B82F6' },
        { companyId: company.id, name: 'Euro Kasa', type: 'Kasa', currency: 'EUR', balance: 0, color: '#8B5CF6' },
      ],
    });

    const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${emailVerifyToken}`;
    try {
      await sendMail({
        to: user.email,
        subject: 'SoleCost - E-posta adresinizi doğrulayın',
        html: `
          <p>Merhaba ${user.name ?? user.email},</p>
          <p>Hesabınız oluşturuldu. Giriş yapabilmek için e-posta adresinizi doğrulamanız gerekmektedir.</p>
          <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">E-postamı Doğrula</a></p>
          <p>Butona tıklayamıyorsanız şu bağlantıyı kopyalayın: ${verifyUrl}</p>
          <p>Bu e-posta, SoleCost hesabınız için otomatik olarak gönderildi.</p>
        `,
        text: `Merhaba ${user.name ?? user.email},\n\nHesabınızı doğrulamak için şu bağlantıya tıklayın:\n${verifyUrl}`,
      });
    } catch (emailError) {
      console.error('Signup email failed:', emailError);
    }

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error?.message ?? 'Internal error' }, { status: 500 });
  }
}
