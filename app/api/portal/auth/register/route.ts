export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerId, email, name, password } = await req.json();
  if (!customerId || !email || !password) {
    return NextResponse.json({ error: 'customerId, email and password required' }, { status: 400 });
  }

  // Ensure customer belongs to this company
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: user.companyId },
  });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const existing = await prisma.portalCustomer.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Bu email zaten kayıtlı' }, { status: 400 });

  const hashedPassword = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');

  const portalCustomer = await prisma.portalCustomer.create({
    data: {
      customerId,
      email,
      name: name || customer.name,
      password: hashedPassword,
      emailVerified: false,
      emailVerifyToken,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/portal/verify-email?token=${emailVerifyToken}`;

  sendMail({
    to: email,
    subject: 'Müşteri Portalı - Hesabınız oluşturuldu',
    html: `
      <p>Merhaba ${portalCustomer.name ?? email},</p>
      <p>Müşteri portalı hesabınız oluşturuldu. Giriş yapabilmek için e-posta adresinizi doğrulayın.</p>
      <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">E-postamı Doğrula</a></p>
      <p>Doğruladıktan sonra <a href="${baseUrl}/portal/login">${baseUrl}/portal/login</a> adresinden giriş yapabilirsiniz.</p>
      <p>Geçici şifreniz: <strong>${password}</strong></p>
    `,
    text: `Doğrulama: ${verifyUrl} | Şifre: ${password}`,
  }).catch(() => {});

  return NextResponse.json({ id: portalCustomer.id, email: portalCustomer.email }, { status: 201 });
}
