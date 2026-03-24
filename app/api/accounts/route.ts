import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const accounts = await prisma.account.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const account = await prisma.account.create({
    data: {
      companyId: user.companyId,
      name: body.name,
      type: body.type || 'Kasa',
      currency: body.currency || 'TRY',
      balance: parseFloat(body.balance) || 0,
      color: body.color || '#3B82F6',
    },
  });
  return NextResponse.json(account);
}
