import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { passwordError } from '@/lib/password';

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token ve yeni şifre zorunlu' }, { status: 400 });
  }
  const pwErr = passwordError(newPassword);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { resetToken: token } });

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş bağlantı' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null, passwordChangedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
