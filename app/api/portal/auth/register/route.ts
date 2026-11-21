export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendMail } from '@/lib/mail';
import { passwordError } from '@/lib/password';
import { esc } from '@/lib/order-email';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Portal hesabı açma yetkiniz yok' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { customerId, name, password } = body ?? {};
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!customerId || !email || !password) {
    return NextResponse.json({ error: 'Müşteri, e-posta ve şifre gerekli' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Geçerli bir e-posta girin' }, { status: 400 });
  const rule = passwordError(password);
  if (rule) return NextResponse.json({ error: rule }, { status: 400 });

  // Ensure customer belongs to this company
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: user.companyId },
  });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const existing = await prisma.portalCustomer.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Bu e-posta ile zaten bir portal hesabı var' }, { status: 400 });
  if (await prisma.portalCustomer.findUnique({ where: { customerId } })) {
    return NextResponse.json({ error: 'Bu müşterinin zaten bir portal hesabı var' }, { status: 400 });
  }

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
      <p>Merhaba ${esc(portalCustomer.name ?? email)},</p>
      <p>Müşteri portalı hesabınız oluşturuldu. Giriş yapabilmek için e-posta adresinizi doğrulayın.</p>
      <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">E-postamı Doğrula</a></p>
      <p>Doğruladıktan sonra <a href="${baseUrl}/portal/login">${baseUrl}/portal/login</a> adresinden giriş yapabilirsiniz.</p>
      <p>Geçici şifreniz: <strong>${esc(password)}</strong> (girişten sonra Ayarlar → Şifre değiştir ile değiştirebilirsiniz)</p>
      <p>Mobil uygulama: <a href="${baseUrl}/indir">${baseUrl}/indir</a></p>
    `,
    text: `Doğrulama: ${verifyUrl} | Şifre: ${password}`,
  }).catch(() => {});

  return NextResponse.json({ id: portalCustomer.id, email: portalCustomer.email }, { status: 201 });
}
