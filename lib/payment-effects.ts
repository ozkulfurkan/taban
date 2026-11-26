// Tahsilat / ödeme kaydının kasa bakiyesine etkisi. Kayıtlar faturaya bağlanmaz; cari bakiye tüm belgeler ve
// ödemeler toplanarak hesaplanır (lib/money.ts). sign = 1 uygular, sign = -1 geri alır.
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
export type PaymentLike = {
  type: string; amount: number; originalAmount: number | null;
  accountId: string | null;
};

export async function applyPaymentEffects(tx: Tx, companyId: string, p: PaymentLike, sign: 1 | -1) {
  if (p.accountId) {
    const by = (p.originalAmount ?? p.amount) * sign;
    await tx.account.updateMany({
      where: { id: p.accountId, companyId },
      data: { balance: { increment: p.type === 'RECEIVED' ? by : -by } },
    });
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
