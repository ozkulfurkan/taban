export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, companyName } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
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

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email?.split?.('@')?.[0] || 'User',
        role: 'COMPANY_OWNER',
        companyId: company.id,
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
    try {
      await sendMail({
        to: user.email,
        subject: 'SoleCost hesabınız oluşturuldu',
        html: `
          <p>Merhaba ${user.name ?? user.email},</p>
          <p>Hesabınız başarılı bir şekilde oluşturuldu.</p>
          <p>Giriş yapmak için <a href="${baseUrl}/login">buraya tıklayın</a>.</p>
          <p>Bu e-posta, SoleCost hesabınız için otomatik olarak gönderildi.</p>
        `,
        text: `Merhaba ${user.name ?? user.email},\n\nHesabınız başarılı bir şekilde oluşturuldu. Giriş yapmak için: ${baseUrl}/login\n\nBu e-posta, SoleCost hesabınız için otomatik olarak gönderildi.`,
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
