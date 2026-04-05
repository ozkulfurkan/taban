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

  const from = fromStr ? (parseDateInput(fromStr) ?? new Date(new Date().setFullYear(new Date().getFullYear() - 1))) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const to = toStr ? (parseDateEndOfDay(toStr) ?? new Date()) : new Date();

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: { id: true, name: true, currency: true },
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId: params.id, date: { gte: from, lte: to } },
      include: { items: { orderBy: { id: 'asc' } } },
      orderBy: { date: 'asc' },
    }),
    prisma.payment.findMany({
      where: { customerId: params.id, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    }),
  ]);

  const totalDebit = invoices.reduce((s, i) => s + i.total, 0);
  const totalCredit = payments.reduce((s, p) => s + p.amount, 0);

  return NextResponse.json({
    customer,
    invoices,
    payments,
    totalDebit,
    totalCredit,
    balance: totalDebit - totalCredit,
  });
}
