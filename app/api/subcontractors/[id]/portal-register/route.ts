import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendMailSafe } from '@/lib/mail';
import { esc } from '@/lib/order-email';
import { passwordError } from '@/lib/password';

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
  const rule = passwordError(password);
  if (rule) return NextResponse.json({ error: rule }, { status: 400 });

  // Aynı e-posta başka firmaların portalında da kullanılabilir; yalnızca bu firmada tekil
  const existing = await prisma.portalCustomer.findFirst({ where: { companyId: subcontractor.companyId, email: { equals: email.trim(), mode: 'insensitive' } } });
  if (existing) return NextResponse.json({ error: 'Bu e-posta ile firmanızda zaten bir portal hesabı var' }, { status: 400 });

  const hashedPassword = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');

  const portalCustomer = await prisma.portalCustomer.create({
    data: {
      companyId: subcontractor.companyId,
      email: email.trim(),
      password: hashedPassword,
      name: name?.trim() || subcontractor.name,
      portalType: 'SUBCONTRACTOR',
      emailVerifyToken,
      subcontractor: { connect: { id: params.id } },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  // Doğrulama sayfası müşteri ve fason portalında ortak; fason=1 ile fason girişine yönlendirir
  const verifyUrl = `${baseUrl}/portal/verify-email?token=${emailVerifyToken}&fason=1`;

  const emailSent = await sendMailSafe({
    to: email.trim(),
    subject: 'Fasoncu Portalı — Hesabınız Oluşturuldu',
    html: `
      <p>Merhaba ${esc(portalCustomer.name)},</p>
      <p>Fasoncu portal hesabınız oluşturuldu.</p>
      <p><strong>Kullanıcı adı (e-posta):</strong> ${esc(email.trim())}</p>
      <p>Şifreniz güvenlik nedeniyle e-postayla gönderilmez; firmanızdan öğrenebilirsiniz.</p>
      <p>Giriş yapmadan önce e-posta adresinizi doğrulayın:</p>
      <p><a href="${verifyUrl}" style="background:#6B1A2C;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">E-postamı Doğrula</a></p>
      <p>Giriş adresi: ${baseUrl}/portal/fason/login</p>
    `,
    text: `Doğrulama linki: ${verifyUrl}`,
  });

  return NextResponse.json({ ok: true, portalCustomerId: portalCustomer.id, emailSent }, { status: 201 });
}
