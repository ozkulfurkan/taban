export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { isActive, newPassword } = body;

  const pc = await prisma.portalCustomer.findFirst({
    where: { id: params.id, customer: { companyId: user.companyId } },
  });
  if (!pc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (newPassword) data.password = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.portalCustomer.update({ where: { id: params.id }, data });
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
