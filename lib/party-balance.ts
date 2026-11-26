// Carinin güncel bakiyesi (fatura / alış detayında gösterilir). Müşteri ve tedarikçi detayıyla aynı hesap.
import { prisma } from '@/lib/prisma';
import { customerBalance, supplierBalance } from '@/lib/money';

export async function customerBalanceOf(companyId: string, customerId: string) {
  const [invoices, payments, cekler] = await Promise.all([
    prisma.invoice.findMany({ where: { companyId, customerId }, select: { total: true, isReturn: true } }),
    prisma.payment.findMany({ where: { companyId, customerId }, select: { amount: true, method: true, notes: true } }),
    prisma.cek.findMany({ where: { companyId, customerId, islem: 'Müşteriden Alınan Çek Kaydı' }, select: { tutar: true, customerAmount: true } }),
  ]);
  return customerBalance(invoices, payments, cekler as any).balance;
}

export async function supplierBalanceOf(companyId: string, supplierId: string) {
  const [purchases, payments] = await Promise.all([
    prisma.purchase.findMany({ where: { companyId, supplierId }, select: { total: true, isReturn: true } }),
    prisma.payment.findMany({ where: { companyId, supplierId }, select: { amount: true, method: true, notes: true } }),
  ]);
  return supplierBalance(purchases, payments).balance;
}
