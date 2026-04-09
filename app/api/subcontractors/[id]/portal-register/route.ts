import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { portalCustomer: true },
  });
  if (!subcontractor) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });
  if (subcontractor.portalCustomer) {
    return NextResponse.json({ error: 'Bu fasoncunun zaten portal hesabı var' }, { status: 400 });
  }

  const { email, name, password } = await req.json();
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: 'Email ve şifre zorunlu' }, { status: 400 });
  }

  const existing = await prisma.portalCustomer.findUnique({ where: { email: email.trim() } });
  if (existing) return NextResponse.json({ error: 'Bu email zaten kayıtlı' }, { status: 400 });

  const hashedPassword = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');

  const portalCustomer = await prisma.portalCustomer.create({
    data: {
      email: email.trim(),
      password: hashedPassword,
      name: name?.trim() || subcontractor.name,
      portalType: 'SUBCONTRACTOR',
      emailVerifyToken,
      subcontractor: { connect: { id: params.id } },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/portal/fason/verify-email?token=${emailVerifyToken}`;

  sendMail({
    to: email.trim(),
    subject: 'Fasoncu Portalı — Hesabınız Oluşturuldu',
    html: `
      <p>Merhaba ${portalCustomer.name},</p>
      <p>Fasoncu portal hesabınız oluşturuldu.</p>
      <p><strong>E-posta:</strong> ${email.trim()}</p>
      <p><strong>Şifre:</strong> ${password}</p>
      <p>Giriş yapmadan önce e-posta adresinizi doğrulayın:</p>
      <p><a href="${verifyUrl}" style="background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">E-postamı Doğrula</a></p>
      <p>Giriş adresi: ${baseUrl}/portal/fason/login</p>
    `,
    text: `Doğrulama linki: ${verifyUrl}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, portalCustomerId: portalCustomer.id }, { status: 201 });
}
