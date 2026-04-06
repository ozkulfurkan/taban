export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { companyId } = await req.json();
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  const owner = await prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_OWNER' },
  });

  if (!owner) {
    return NextResponse.json({ error: 'Company owner not found' }, { status: 404 });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 dakika

  await prisma.user.update({
    where: { id: owner.id },
    data: { impersonateToken: token, impersonateTokenExpiry: expiry },
  });

  return NextResponse.json({ token });
}
