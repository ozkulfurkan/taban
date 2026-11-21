export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PORTAL_CUSTOMER_PUBLIC } from '@/lib/portal-public';
import bcrypt from 'bcryptjs';
import { passwordError } from '@/lib/password';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Portal hesabını değiştirme yetkiniz yok' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { isActive, newPassword } = body ?? {};
  if (newPassword) {
    const rule = passwordError(newPassword);
    if (rule) return NextResponse.json({ error: rule }, { status: 400 });
  }

  const pc = await prisma.portalCustomer.findFirst({
    where: { id: params.id, customer: { companyId: user.companyId } },
  });
  if (!pc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (newPassword) {
    data.password = await bcrypt.hash(newPassword, 12);
    data.passwordChangedAt = new Date(); // açık oturumlar kapanır
  }

  const updated = await prisma.portalCustomer.update({ where: { id: params.id }, data, select: PORTAL_CUSTOMER_PUBLIC });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.portalCustomer.deleteMany({
    where: { id: params.id, customer: { companyId: user.companyId } },
  });
  return NextResponse.json({ ok: true });
}
