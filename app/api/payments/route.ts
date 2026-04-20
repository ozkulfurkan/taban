import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInputOrNow } from '@/lib/time';
import { logAction, getIp } from '@/lib/audit-logger';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const payments = await prisma.payment.findMany({
    where: { companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNo: true } },
    },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const {
    invoiceId, purchaseId, customerId, supplierId,
    amount, currency, date, method, notes,
    accountId, originalAmount, originalCurrency, exchangeRate,
    _type,
  } = body;

  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        companyId: user.companyId,
        type: (_type as any) || (customerId ? 'RECEIVED' : 'PAID'),
        customerId: customerId || null,
        supplierId: supplierId || null,
        invoiceId: invoiceId || null,
        purchaseId: purchaseId || null,
        accountId: accountId || null,
        amount: parseFloat(amount),
        currency: currency || 'TRY',
        originalAmount: originalAmount ? parseFloat(originalAmount) : null,
        originalCurrency: originalCurrency || null,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
        date: parseDateInputOrNow(date),
        method: method || 'Nakit',
        notes: notes || null,
      },
    });

    // Update invoice paidAmount and status
    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (invoice) {
        const newPaid = invoice.paidAmount + parseFloat(amount);
        let status: any = invoice.status;
        if (newPaid <= 0) status = 'PENDING';
        else if (newPaid < invoice.total) status = 'PARTIAL';
        else status = 'PAID';

        await tx.invoice.update({
          where: { id: invoiceId },
          data: { paidAmount: newPaid, status },
        });
      }
    }

    // Update purchase paidAmount and status
    if (purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
      if (purchase) {
        const newPaid = purchase.paidAmount + parseFloat(amount);
        let status: any = purchase.status;
        if (newPaid <= 0) status = 'PENDING';
        else if (newPaid < purchase.total) status = 'PARTIAL';
        else status = 'PAID';

        await tx.purchase.update({
          where: { id: purchaseId },
          data: { paidAmount: newPaid, status },
        });
      }
    }

    // Update account balance: incoming → increment, outgoing → decrement
    // _type overrides the customerId heuristic (used by Para Girişi / Para Çıkışı buttons)
    if (accountId) {
      const incrementBy = originalAmount ? parseFloat(originalAmount) : parseFloat(amount);
      const isIncoming = _type ? _type === 'RECEIVED' : !!customerId;
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: isIncoming ? incrementBy : -incrementBy } },
      });
    }

    return p;
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'Payment',
    entityId: payment.id,
    detail: `Ödeme kaydedildi — ${payment.method} ${payment.amount} ${payment.currency}`,
    meta: { amount: payment.amount, currency: payment.currency, method: payment.method },
    ip: getIp(req),
  });
  return NextResponse.json(payment);
}
