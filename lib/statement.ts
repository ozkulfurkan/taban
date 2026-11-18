import { prisma } from '@/lib/prisma';
import { parseDateInput, parseDateEndOfDay } from '@/lib/time';

// Hesap ekstresi sorguları. İç ekstre uç noktaları ve link ile paylaşılan ekstre aynı sorguyu kullanır.

export function statementRange(fromStr: string | null, toStr: string | null) {
  const yearAgo = () => new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const from = (fromStr && parseDateInput(fromStr)) || yearAgo();
  const to = (toStr && parseDateEndOfDay(toStr)) || new Date();
  return { from, to };
}

export async function loadCustomerStatement(companyId: string, customerId: string, from: Date, to: Date) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true, name: true, currency: true, email: true, phone: true },
  });
  if (!customer) return null;

  const [invoices, payments, cekler] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId, companyId, date: { gte: from, lte: to } },
      include: { items: { include: { product: { select: { code: true } } }, orderBy: { id: 'asc' } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.payment.findMany({
      where: { customerId, companyId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.cek.findMany({
      where: { customerId, companyId, islemTarihi: { gte: from, lte: to } },
      orderBy: [{ islemTarihi: 'asc' }],
    }),
  ]);

  const totalDebit = invoices.filter(i => !i.isReturn).reduce((s, i) => s + i.total, 0);
  const totalCredit = payments.reduce((s, p) => s + p.amount, 0)
    + invoices.filter(i => i.isReturn).reduce((s, i) => s + Math.abs(i.total), 0)
    + cekler.reduce((s, c) => s + ((c as any).customerAmount ?? c.tutar), 0);

  return { customer, invoices, payments, cekler, totalDebit, totalCredit, balance: totalDebit - totalCredit };
}

export async function loadSupplierStatement(
  companyId: string, supplierId: string, from: Date, to: Date, opts: { items?: boolean } = {},
) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: { id: true, name: true, currency: true, email: true, phone: true },
  });
  if (!supplier) return null;

  const [rawPurchases, payments] = await Promise.all([
    prisma.purchase.findMany({
      where: { supplierId, companyId, date: { gte: from, lte: to } },
      include: opts.items
        ? { purchaseMaterials: { include: { material: { select: { name: true } }, product: { select: { name: true, code: true } } }, orderBy: { createdAt: 'asc' } } }
        : undefined,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.payment.findMany({
      where: { supplierId, companyId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  // Alış kalemleri ekstre satırı biçimine (description/quantity/unitPrice) çevrilir
  const purchases = rawPurchases.map((p: any) => {
    if (!opts.items) return p;
    const { purchaseMaterials, ...rest } = p;
    return {
      ...rest,
      items: (purchaseMaterials || []).map((m: any) => ({
        description: m.material?.name || m.product?.name || '',
        quantity: m.kgAmount,
        unitPrice: m.pricePerKg ?? null,
        total: m.pricePerKg != null ? Math.round(m.kgAmount * m.pricePerKg * 100) / 100 : null,
        product: m.product?.code ? { code: m.product.code } : null,
      })),
    };
  });

  // Alış borç, alış iadesi alacak tarafına yazılır
  const totalDebit = purchases.filter((p: any) => !p.isReturn).reduce((s: number, p: any) => s + p.total, 0);
  const totalCredit = payments.reduce((s, p) => s + p.amount, 0)
    + purchases.filter((p: any) => p.isReturn).reduce((s: number, p: any) => s + Math.abs(p.total), 0);

  return { supplier, purchases, payments, totalDebit, totalCredit, balance: totalDebit - totalCredit };
}
