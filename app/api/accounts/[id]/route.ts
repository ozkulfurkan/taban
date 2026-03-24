import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const account = await prisma.account.updateMany({
    where: { id: params.id, companyId: user.companyId },
    data: {
      name: body.name,
      currency: body.currency,
      balance: parseFloat(body.balance) ?? 0,
      color: body.color,
    },
  });
  return NextResponse.json(account);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  // Unlink payments from this account before deleting
  await prisma.payment.updateMany({
    where: { accountId: params.id, companyId: user.companyId },
    data: { accountId: null },
  });

  await prisma.account.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
