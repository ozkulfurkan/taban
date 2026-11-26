// Satış / satış iadesi kaydı: fatura ekranı (/api/invoices) ve sevk fişi (lib/dispatch.ts) aynı kodu kullanır.
// Belge numarası, kalem doğrulaması, ürün stoğu ve (taban üreticisinde) reçeteden hammadde düşümü burada.
import { prisma } from '@/lib/prisma';
import { nowUtc, parseDateInput } from '@/lib/time';
import { validateInvoiceInput } from '@/lib/invoice-input';
import { nextDocumentNumber, documentYear } from '@/lib/doc-number';

export type SaleInvoiceResult =
  | { ok: true; invoice: any; negativeStock: Array<{ id: string; name: string; code: string | null; stock: number; unit: string | null }> }
  | { ok: false; error: string; status: number };

/**
 * body: /api/invoices POST gövdesi ({ customerId, items, vatRate, date, currency, invoiceNo?, irsaliyeNo?, sevkTarihi?, notes?, isReturn? }).
 * Müşterinin para birimi kullanılır; farklı para birimi gelirse hata.
 */
export async function createSaleInvoice(companyId: string, userId: string | null, body: any): Promise<SaleInvoiceResult> {
  const { items = [], isReturn = false, ...rest } = body ?? {};
  if (!rest.customerId) return { ok: false, error: 'Müşteri seçilmedi', status: 400 };

  const customer = await prisma.customer.findFirst({ where: { id: rest.customerId, companyId }, select: { currency: true } });
  if (customer && rest.currency && customer.currency !== rest.currency) {
    return { ok: false, error: `Para birimi uyumsuz. Müşteri para birimi: ${customer.currency}`, status: 400 };
  }
  if (customer?.currency) rest.currency = customer.currency;

  const input = validateInvoiceInput({ ...body, items });
  if (!input.ok) return { ok: false, error: input.error, status: 400 };
  const { lines, vatRate, subtotal, vatAmount, total } = input;
  const invoiceDate = parseDateInput(rest.date) ?? nowUtc();
  // Yıl fatura tarihinden alınır (2027 tarihli fatura FTR-2027- ile başlar)
  const ftrPrefix = `${isReturn ? 'IAD' : 'FTR'}-${documentYear(invoiceDate)}-`;
  const manualNo = typeof rest.invoiceNo === 'string' && rest.invoiceNo.trim() ? rest.invoiceNo.trim() : null;
  if (manualNo && await prisma.invoice.findFirst({ where: { companyId, invoiceNo: manualNo }, select: { id: true } })) {
    return { ok: false, error: `${manualNo} numaralı fatura zaten var`, status: 409 };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const resolvedInvoiceNo = manualNo ?? await nextDocumentNumber('invoice', companyId, ftrPrefix, { db: tx });
    return tx.invoice.create({
      data: {
        companyId,
        customerId: rest.customerId,
        invoiceNo: resolvedInvoiceNo,
        date: invoiceDate,
        dueDate: rest.dueDate ? parseDateInput(rest.dueDate) : null,
        irsaliyeNo: typeof rest.irsaliyeNo === 'string' && rest.irsaliyeNo.trim() ? rest.irsaliyeNo.trim() : null,
        sevkTarihi: rest.sevkTarihi ? parseDateInput(rest.sevkTarihi) : null,
        currency: rest.currency || 'USD',
        // Tutarlar iade faturasında da pozitif saklanır; yönü isReturn belirler
        subtotal, vatRate, vatAmount, total,
        paidAmount: 0,
        status: 'PENDING',
        isReturn,
        notes: rest.notes || null,
        createdById: userId || null,
        items: { create: lines },
      },
      include: { items: true, customer: true },
    });
  });

  // Ürün stoğu
  const productItems = lines.filter((i): i is typeof i & { productId: string } => !!i.productId);
  await Promise.all(productItems.map(i => prisma.product.updateMany({
    where: { id: i.productId, companyId },
    data: { stock: { increment: isReturn ? i.quantity : -i.quantity } },
  })));

  // Otomatik hammadde stoğu düşümü (yalnızca taban üreticisinin satışlarında)
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { companyType: true } });
  if (productItems.length > 0 && !isReturn && company?.companyType !== 'MATERIAL_SUPPLIER') {
    const uniqueProductIds = Array.from(new Set(productItems.map(i => i.productId)));
    const products = await prisma.product.findMany({ where: { id: { in: uniqueProductIds }, companyId }, include: { parts: true } });
    const materialMap = new Map<string, number>(); // materialId -> kg
    for (const item of productItems) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      const partVariants: Array<{ partId: string; materialId: string }> = Array.isArray(item.partVariantsData) ? (item.partVariantsData as any) : [];
      for (const part of product.parts) {
        const matId = partVariants.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
        if (!matId) continue;
        const kgUsed = (part.gramsPerPiece * (1 + part.wasteRate / 100) * item.quantity) / 1000;
        materialMap.set(matId, (materialMap.get(matId) || 0) + kgUsed);
      }
    }
    const updates: Promise<any>[] = Array.from(materialMap.entries()).map(([materialId, kg]) =>
      prisma.material.updateMany({ where: { id: materialId, companyId }, data: { stock: { decrement: kg } } }));
    if (updates.length > 0) {
      updates.push(prisma.invoice.update({ where: { id: invoice.id }, data: { stockDeducted: true } }));
      await Promise.all(updates);
    }
  }

  // Stok eksiye düşebilir (satış engellenmez) ama kullanıcı uyarılır
  const negativeStock = productItems.length && !isReturn
    ? await prisma.product.findMany({
        where: { id: { in: productItems.map(i => i.productId) }, companyId, stock: { lt: 0 } },
        select: { id: true, name: true, code: true, stock: true, unit: true },
      })
    : [];
  return { ok: true, invoice, negativeStock };
}
