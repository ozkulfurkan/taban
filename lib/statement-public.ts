import { prisma } from '@/lib/prisma';
import { loadCustomerStatement, loadSupplierStatement } from '@/lib/statement';

// Firma dışına gösterilen ekstre (paylaşım linki ve firma ağındaki karşı taraf).
// İç kimlikler yerine sıra numarası döner; yalnızca ekstrede görünen alanlar yer alır.

export type StatementParty = { customerId: string } | { supplierId: string };

export async function statementCompany(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, logoUrl: true, phone: true, address: true, taxId: true },
  });
}

export async function publicStatementBody(companyId: string, party: StatementParty, from: Date, to: Date) {
  if ('customerId' in party) {
    const d = await loadCustomerStatement(companyId, party.customerId, from, to);
    if (!d) return null;
    return {
      kind: 'customer' as const,
      party: { name: d.customer.name, currency: d.customer.currency },
      invoices: d.invoices.map((i, n) => ({
        id: `f${n}`, invoiceNo: i.invoiceNo, date: i.date, dueDate: i.dueDate, total: i.total, currency: i.currency,
        isReturn: i.isReturn, notes: i.notes, createdAt: i.createdAt,
        items: i.items.map(it => ({
          description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total,
          product: it.product?.code ? { code: it.product.code } : null,
        })),
      })),
      payments: d.payments.map((p, n) => publicPayment(p, n)),
      cekler: d.cekler.map((c, n) => ({
        id: `c${n}`, islem: c.islem, borclu: c.borclu, bankasi: c.bankasi, seriNo: c.seriNo,
        islemTarihi: c.islemTarihi, vadesi: c.vadesi, tutar: c.tutar, currency: c.currency,
        customerAmount: (c as any).customerAmount ?? null, createdAt: c.createdAt,
      })),
    };
  }
  const d = await loadSupplierStatement(companyId, party.supplierId, from, to, { items: true });
  if (!d) return null;
  return {
    kind: 'supplier' as const,
    party: { name: d.supplier.name, currency: d.supplier.currency },
    purchases: d.purchases.map((p: any, n: number) => ({
      id: `a${n}`, invoiceNo: p.invoiceNo, date: p.date, total: p.total, currency: p.currency,
      isReturn: p.isReturn, notes: p.notes, createdAt: p.createdAt, items: p.items,
    })),
    payments: d.payments.map((p, n) => publicPayment(p, n)),
  };
}

function publicPayment(p: any, n: number) {
  return { id: `p${n}`, date: p.date, amount: p.amount, currency: p.currency, method: p.method, notes: p.notes, createdAt: p.createdAt };
}
