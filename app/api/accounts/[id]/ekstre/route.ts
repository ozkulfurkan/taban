import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInput, parseDateEndOfDay } from '@/lib/time';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  const account = await prisma.account.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const dateFilter: any = {};
  if (fromStr) dateFilter.gte = parseDateInput(fromStr);
  if (toStr) dateFilter.lte = parseDateEndOfDay(toStr);

  const payments = await prisma.payment.findMany({
    where: {
      accountId: params.id,
      companyId: user.companyId,
      ...(fromStr || toStr ? { date: dateFilter } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Tüm hesaplar (transfer dropdown için)
  const allAccounts = await prisma.account.findMany({
    where: { companyId: user.companyId },
    select: { id: true, name: true, currency: true, balance: true, color: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ account, payments, allAccounts });
}
