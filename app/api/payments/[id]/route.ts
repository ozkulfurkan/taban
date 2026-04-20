import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const deletedPayment = await prisma.payment.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: { amount: true, currency: true, method: true, customerId: true, supplierId: true },
  });
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

    // Kasa bakiyesini geri al
    if (payment.accountId) {
      const reversalAmount = payment.originalAmount ?? payment.amount;
      const isIncoming = payment.type === 'RECEIVED';
      await tx.account.update({
        where: { id: payment.accountId },
        data: { balance: { increment: isIncoming ? -reversalAmount : reversalAmount } },
      });
    }

    // Fatura ödeme tutarını geri al
    if (payment.invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice) {
        const newPaid = Math.max(0, invoice.paidAmount - payment.amount);
        const status = newPaid <= 0 ? 'PENDING' : newPaid < invoice.total ? 'PARTIAL' : 'PAID';
        await tx.invoice.update({ where: { id: payment.invoiceId }, data: { paidAmount: newPaid, status } });
      }
    }

    // Alış ödeme tutarını geri al
    if (payment.purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: payment.purchaseId } });
      if (purchase) {
        const newPaid = Math.max(0, purchase.paidAmount - payment.amount);
        const status = newPaid <= 0 ? 'PENDING' : newPaid < purchase.total ? 'PARTIAL' : 'PAID';
        await tx.purchase.update({ where: { id: payment.purchaseId }, data: { paidAmount: newPaid, status } });
      }
    }

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
}
