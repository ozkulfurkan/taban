// Tahsilat / ödeme kaydının bağlı kayıtlara etkisi: kasa bakiyesi, fatura ve alışın ödenen tutarı ve durumu.
// sign = 1 uygular, sign = -1 geri alır. Düzenlemede önce eski kayıt geri alınır, sonra yenisi uygulanır.
import type { Prisma } from '@prisma/client';
import { round2 } from '@/lib/money';

type Tx = Prisma.TransactionClient;
export type PaymentLike = {
  type: string; amount: number; originalAmount: number | null;
  accountId: string | null; invoiceId: string | null; purchaseId: string | null;
};

const statusOf = (paid: number, total: number) => (paid <= 0.005 ? 'PENDING' : paid < Math.abs(total) - 0.005 ? 'PARTIAL' : 'PAID');

export async function applyPaymentEffects(tx: Tx, companyId: string, p: PaymentLike, sign: 1 | -1) {
  if (p.accountId) {
    const by = (p.originalAmount ?? p.amount) * sign;
    await tx.account.updateMany({
      where: { id: p.accountId, companyId },
      data: { balance: { increment: p.type === 'RECEIVED' ? by : -by } },
    });
  }
  if (p.invoiceId) {
    const inv = await tx.invoice.findFirst({ where: { id: p.invoiceId, companyId } });
    if (inv) {
      const paid = Math.max(0, round2(inv.paidAmount + sign * p.amount));
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status: statusOf(paid, inv.total) as any } });
    }
  }
  if (p.purchaseId) {
    const pur = await tx.purchase.findFirst({ where: { id: p.purchaseId, companyId } });
    if (pur) {
      const paid = Math.max(0, round2(pur.paidAmount + sign * p.amount));
      await tx.purchase.update({ where: { id: pur.id }, data: { paidAmount: paid, status: statusOf(paid, pur.total) as any } });
    }
  }
}
