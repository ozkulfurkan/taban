import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function canManage(role: string) {
  return role === 'ADMIN' || role === 'COMPANY_OWNER';
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = session.user as any;
  if (!canManage(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const target = await prisma.user.findFirst({
    where: { id: params.id, companyId: actor.companyId },
  });
  if (!target) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

  const body = await req.json();
  const { name, role, allowedPages, newPassword, generateResetToken } = body;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (allowedPages !== undefined) data.allowedPages = allowedPages;
  if (newPassword) {
    data.password = await bcrypt.hash(newPassword, 12);
  }
  if (generateResetToken) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    data.resetToken = token;
    data.resetTokenExpiry = expiry;
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, allowedPages: true, resetToken: true, createdAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = session.user as any;
  if (!canManage(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Cannot delete yourself
  if (params.id === actor.id) {
    return NextResponse.json({ error: 'Kendinizi silemezsiniz' }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, companyId: actor.companyId },
  });
  if (!target) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

  // Cannot delete the last COMPANY_OWNER
  if (target.role === 'COMPANY_OWNER') {
    const ownerCount = await prisma.user.count({
      where: { companyId: actor.companyId, role: 'COMPANY_OWNER' },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: 'Son firma yöneticisi silinemez' }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
