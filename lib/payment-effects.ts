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

/** Çekle yapılmış kayıt silinirken çeki portföye geri alır */
export async function releaseCheque(tx: Tx, companyId: string, p: PaymentLike & { id: string; method: string; customerId: string | null; supplierId: string | null; notes: string | null }) {
  if (p.method !== 'Çek') return;
  if (p.type === 'RECEIVED') {
    // Tahsil edilmiş çek: paymentId ile bulunur
    await tx.cek.updateMany({ where: { paymentId: p.id, companyId }, data: { durum: 'PORTFOY', paymentId: null } as any });
    return;
  }
  // Tedarikçiye / bankaya verilen çek: tutar + cari + seri no ile bulunur
  const where: any = { companyId, tutar: p.originalAmount ?? p.amount, durum: { not: 'PORTFOY' } };
  if (p.customerId) where.customerId = p.customerId;
  if (p.supplierId) where.supplierId = p.supplierId;
  const seriNo = p.notes?.split(' | ').find(x => x.startsWith('Çek No: '))?.slice('Çek No: '.length);
  if (seriNo) where.seriNo = seriNo;
  await tx.cek.updateMany({ where, data: { durum: 'PORTFOY', customerId: null, supplierId: null } as any });
}
