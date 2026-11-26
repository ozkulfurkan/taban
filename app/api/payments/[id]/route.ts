import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';
import { applyPaymentEffects } from '@/lib/payment-effects';
import { parseAmount, round2 } from '@/lib/money';
import { parseDateInput } from '@/lib/time';
import { rejectForeignRefs } from '@/lib/tenant';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const deletedPayment = await prisma.payment.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: { amount: true, currency: true, method: true, customerId: true, supplierId: true },
  });
  try {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (!payment) return;

    // Çek ödemesi silindiyse ilgili çeki portföye geri al
    if (payment.method === 'Çek') {
      if (payment.type === 'RECEIVED') {
        // Tahsil edilmiş çek: paymentId ile direkt bul ve portföye al
        await (tx.cek as any).updateMany({
          where: { paymentId: payment.id, companyId: user.companyId },
          data: { durum: 'PORTFOY', paymentId: null },
        });
      } else {
        // Tedarikçiye/bankaya verilen çek: tutar+supplierId+seriNo ile bul
        const checkTutar = payment.originalAmount ?? payment.amount;
        const whereClause: any = {
          companyId: user.companyId,
          tutar: checkTutar,
          durum: { not: 'PORTFOY' },
        };
        if (payment.customerId) whereClause.customerId = payment.customerId;
        if (payment.supplierId) whereClause.supplierId = payment.supplierId;
        if (payment.notes) {
          const seriNoPart = payment.notes.split(' | ').find((s: string) => s.startsWith('Çek No: '));
          const seriNo = seriNoPart ? seriNoPart.slice('Çek No: '.length) : null;
          if (seriNo) whereClause.seriNo = seriNo;
        }
        await (tx.cek as any).updateMany({
          where: whereClause,
          data: { durum: 'PORTFOY', customerId: null, supplierId: null },
        });
      }
    }

    // Kasa bakiyesi, fatura ve alış ödeme tutarı geri alınır
    await applyPaymentEffects(tx, user.companyId, payment, -1);

    await tx.payment.delete({ where: { id: params.id } });
  });

  if (deletedPayment) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'DELETE',
      entity: 'Payment',
      entityId: params.id,
      detail: `Ödeme silindi — ${deletedPayment.method} ${deletedPayment.amount} ${deletedPayment.currency}`,
      meta: { amount: deletedPayment.amount, currency: deletedPayment.currency, method: deletedPayment.method },
      ip: getIp(_),
    });
  }
  return NextResponse.json({ ok: true });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Payment',
      entityId: params.id,
      detail: `Ödeme silinemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      ip: getIp(_),
    });
    return NextResponse.json({ error: 'Ödeme silinemedi' }, { status: 500 });
  }
}

// Düzenle: tutar, tarih, açıklama, kasa, döviz tutarı ve kur. Eski kayıt bağlı kayıtlardan geri alınır, yenisi uygulanır.
// Çek ile yapılan kayıtta yalnızca tarih ve açıklama değişir (çek portföy bağı korunur).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });
  const old = await prisma.payment.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!old) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const amount = body.amount !== undefined ? round2(parseAmount(body.amount)) : old.amount;
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Tutar sıfırdan büyük olmalı' }, { status: 400 });
  if (amount > 1_000_000_000) return NextResponse.json({ error: 'Tutar çok büyük' }, { status: 400 });
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const originalAmount = has('originalAmount') ? (body.originalAmount ? round2(parseAmount(body.originalAmount)) : null) : old.originalAmount;
  const exchangeRate = has('exchangeRate') ? (body.exchangeRate ? parseAmount(body.exchangeRate) : null) : old.exchangeRate;
  const originalCurrency = has('originalCurrency') ? (body.originalCurrency || null) : old.originalCurrency;
  if ((originalAmount !== null && !(originalAmount > 0)) || (exchangeRate !== null && !(exchangeRate > 0))) {
    return NextResponse.json({ error: 'Döviz tutarı veya kur geçersiz' }, { status: 400 });
  }
  const date = has('date') && body.date ? parseDateInput(body.date) : old.date;
  if (!date) return NextResponse.json({ error: 'Tarih geçersiz' }, { status: 400 });
  const accountId = has('accountId') ? (body.accountId || null) : old.accountId;
  const notes = has('notes') ? (typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) || null : null) : old.notes;
  const foreign = await rejectForeignRefs(user.companyId, { account: accountId });
  if (foreign) return foreign;

  // Çek (portföy bağı) ve hesaplar arası transfer (iki kayıt) için yalnızca tarih ve açıklama değişir
  if ((old.method === 'Çek' || old.method === 'Transfer') && (Math.abs(amount - old.amount) > 0.001 || accountId !== old.accountId || originalAmount !== old.originalAmount)) {
    const what = old.method === 'Çek' ? 'Çek ile yapılan kayıtta' : 'Hesaplar arası transferde';
    return NextResponse.json({ error: `${what} yalnızca tarih ve açıklama değiştirilebilir. Tutarı değiştirmek için kaydı silip yeniden girin.` }, { status: 400 });
  }

  // Fatura / alış: fazla ödeme onayı (bu kaydın eski tutarı hariç)
  const target = old.invoiceId
    ? await prisma.invoice.findFirst({ where: { id: old.invoiceId, companyId: user.companyId }, select: { total: true, paidAmount: true, currency: true } })
    : old.purchaseId
      ? await prisma.purchase.findFirst({ where: { id: old.purchaseId, companyId: user.companyId }, select: { total: true, paidAmount: true, currency: true } })
      : null;
  if (target && !body.allowOverpayment) {
    const remaining = round2(Math.abs(target.total) - (target.paidAmount - old.amount));
    if (amount > remaining + 0.005) {
      return NextResponse.json({
        error: `Bu tutar kalan tutardan ${round2(amount - Math.max(remaining, 0))} ${target.currency} fazla.`,
        code: 'OVERPAYMENT', remaining: Math.max(remaining, 0), currency: target.currency,
      }, { status: 409 });
    }
  }

  const updated = await prisma.$transaction(async tx => {
    await applyPaymentEffects(tx, user.companyId, old, -1);
    const p = await tx.payment.update({
      where: { id: old.id },
      data: { amount, originalAmount, originalCurrency: originalAmount ? originalCurrency : null, exchangeRate: originalAmount ? exchangeRate : null, date, accountId, notes },
    });
    await applyPaymentEffects(tx, user.companyId, p, 1);
    return p;
  });

  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'UPDATE', entity: 'Payment', entityId: old.id,
    detail: `Ödeme düzenlendi — ${old.amount} → ${updated.amount} ${updated.currency}`,
    meta: { before: { amount: old.amount, date: old.date, accountId: old.accountId }, after: { amount: updated.amount, date: updated.date, accountId: updated.accountId } },
    ip: getIp(req),
  });
  return NextResponse.json(updated);
}
