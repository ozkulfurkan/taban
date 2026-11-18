import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rejectForeignRefs } from '@/lib/tenant';
import { parseAmount, round2 } from '@/lib/money';
import { parseDateInput, parseDateInputOrNow } from '@/lib/time';
import { logAction, getIp } from '@/lib/audit-logger';
import { pageParams, pageResult, dateRange } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const date = dateRange(searchParams);
  const where: any = {
    companyId: user.companyId,
    ...(type === 'RECEIVED' || type === 'PAID' ? { type } : {}),
    ...(date ? { date } : {}),
  };
  const include = {
    customer: { select: { id: true, name: true } },
    supplier: { select: { id: true, name: true } },
    invoice: { select: { id: true, invoiceNo: true } },
  };
  const orderBy = [{ date: 'desc' as const }, { createdAt: 'desc' as const }];

  // Sayfalı kullanım (?page=): toplamlar para birimine göre ayrı (TL ile USD toplanmaz)
  if (searchParams.has('page')) {
    const { page, limit, skip, take } = pageParams(searchParams);
    const [items, total, sums] = await Promise.all([
      prisma.payment.findMany({ where, include, orderBy, skip, take }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({ by: ['type', 'currency'], where, _sum: { amount: true } }),
    ]);
    const totals = sums.map(s => ({ type: s.type, currency: s.currency, amount: round2(s._sum.amount ?? 0) }));
    return NextResponse.json({ ...pageResult(items, total, page, limit), totals });
  }

  const payments = await prisma.payment.findMany({ where, include, orderBy, take: 1000 });
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
    currency, date, method, notes,
    accountId, originalCurrency,
    _type, allowOverpayment,
  } = body;

  // Tutarlar Türkçe biçimde de gelebilir ("1.234,56"); kuruşa yuvarlanır
  const amount = round2(parseAmount(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Tutar sıfırdan büyük olmalı' }, { status: 400 });
  }
  if (amount > 1_000_000_000) return NextResponse.json({ error: 'Tutar çok büyük' }, { status: 400 });
  const originalAmount = body.originalAmount ? round2(parseAmount(body.originalAmount)) : null;
  const exchangeRate = body.exchangeRate ? parseAmount(body.exchangeRate) : null;
  if ((originalAmount !== null && !(originalAmount > 0)) || (exchangeRate !== null && !(exchangeRate > 0))) {
    return NextResponse.json({ error: 'Döviz tutarı veya kur geçersiz' }, { status: 400 });
  }
  if (date && !parseDateInput(date)) return NextResponse.json({ error: 'Ödeme tarihi geçersiz' }, { status: 400 });

  const foreign = await rejectForeignRefs(user.companyId, {
    invoice: invoiceId, purchase: purchaseId, customer: customerId, supplier: supplierId, account: accountId,
  });
  if (foreign) return foreign;

  // "amount" her zaman bağlı kaydın para birimindedir; yabancı para originalAmount'ta tutulur.
  // Ekranlar çeviriyi yapıyor, sunucu da kontrol eder (USD faturaya "100 TRY" yazılmasın).
  const [invoice, purchase, customer, supplier] = await Promise.all([
    invoiceId ? prisma.invoice.findFirst({ where: { id: invoiceId, companyId: user.companyId } }) : null,
    purchaseId ? prisma.purchase.findFirst({ where: { id: purchaseId, companyId: user.companyId } }) : null,
    customerId ? prisma.customer.findFirst({ where: { id: customerId, companyId: user.companyId }, select: { currency: true } }) : null,
    supplierId ? prisma.supplier.findFirst({ where: { id: supplierId, companyId: user.companyId }, select: { currency: true } }) : null,
  ]);
  const expectedCurrency = invoice?.currency ?? purchase?.currency ?? customer?.currency ?? supplier?.currency;
  const paymentCurrency = currency || expectedCurrency || 'TRY';
  if (expectedCurrency && paymentCurrency !== expectedCurrency) {
    return NextResponse.json({
      error: `Tutar ${expectedCurrency} cinsinden girilmeli. Farklı para birimiyle ödeme için döviz tutarı ve kur girin.`,
    }, { status: 400 });
  }

  // Fazla ödeme: kullanıcı onaylamadıysa kaydetme, onay iste
  const target = invoice ?? purchase;
  if (target && !allowOverpayment) {
    const remaining = round2(Math.abs(target.total) - target.paidAmount);
    if (amount > remaining + 0.005) {
      return NextResponse.json({
        error: `Bu ödeme kalan tutardan ${round2(amount - Math.max(remaining, 0))} ${expectedCurrency} fazla.`,
        code: 'OVERPAYMENT',
        remaining: Math.max(remaining, 0),
        currency: expectedCurrency,
      }, { status: 409 });
    }
  }

  try {
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
        amount,
        currency: paymentCurrency,
        originalAmount,
        originalCurrency: originalCurrency || null,
        exchangeRate,
        date: parseDateInputOrNow(date),
        method: method || 'Nakit',
        notes: notes || null,
      },
    });

    // Update invoice paidAmount and status
    if (invoiceId) {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId: user.companyId } });
      if (invoice) {
        const newPaid = round2(invoice.paidAmount + amount);
        let status: any = invoice.status;
        if (newPaid <= 0) status = 'PENDING';
        else if (newPaid < Math.abs(invoice.total) - 0.005) status = 'PARTIAL';
        else status = 'PAID';

        await tx.invoice.update({
          where: { id: invoiceId },
          data: { paidAmount: newPaid, status },
        });
      }
    }

    // Update purchase paidAmount and status
    if (purchaseId) {
      const purchase = await tx.purchase.findFirst({ where: { id: purchaseId, companyId: user.companyId } });
      if (purchase) {
        const newPaid = round2(purchase.paidAmount + amount);
        let status: any = purchase.status;
        if (newPaid <= 0) status = 'PENDING';
        else if (newPaid < purchase.total - 0.005) status = 'PARTIAL';
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
      const incrementBy = originalAmount ?? amount;
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
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Payment',
      detail: `Ödeme kaydedilemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      meta: { amount, currency, method },
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Ödeme kaydedilemedi' }, { status: 500 });
  }
}
