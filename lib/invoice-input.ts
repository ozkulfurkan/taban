import { parseAmount, parseAmountOr, invoiceTotals } from '@/lib/money';
import { parseDateInput } from '@/lib/time';

// Fatura oluşturma/düzenleme girdisinin sunucu tarafı doğrulaması.
// Ekrandaki formlar da bu kurallara uyar; API'ye doğrudan gelen hatalı veri
// (negatif miktar, %150 iskonto, "abc" fiyat...) kayda dönüşmez.

const MAX_QTY = 10_000_000;
const MAX_PRICE = 1_000_000_000;

export type NormalizedLine = {
  description: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  notes: string | null;
  partVariantsData?: any;
};

type Result =
  | { ok: true; lines: NormalizedLine[]; vatRate: number; subtotal: number; vatAmount: number; total: number }
  | { ok: false; error: string };

export function validateInvoiceInput(body: any, opts: { defaultVatRate?: number } = {}): Result {
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Faturada en az bir kalem olmalı' };
  }

  const vatRate = parseAmountOr(body?.vatRate, opts.defaultVatRate ?? 0);
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return { ok: false, error: 'KDV oranı 0 ile 100 arasında olmalı' };
  }

  if (body?.date && !parseDateInput(body.date)) return { ok: false, error: 'Fatura tarihi geçersiz' };
  if (body?.dueDate && !parseDateInput(body.dueDate)) return { ok: false, error: 'Vade tarihi geçersiz' };

  const lines: Omit<NormalizedLine, 'total'>[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const i = items[idx] ?? {};
    const n = `${idx + 1}. kalem`;
    const quantity = parseAmount(i.quantity);
    const unitPrice = parseAmount(i.unitPrice);
    const discount = parseAmountOr(i.discount, 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: `${n}: miktar 0'dan büyük olmalı` };
    if (quantity > MAX_QTY) return { ok: false, error: `${n}: miktar çok büyük` };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: `${n}: birim fiyat geçersiz` };
    if (unitPrice > MAX_PRICE) return { ok: false, error: `${n}: birim fiyat çok büyük` };
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return { ok: false, error: `${n}: iskonto %0 ile %100 arasında olmalı` };
    const description = String(i.description ?? '').trim();
    if (!description) return { ok: false, error: `${n}: açıklama boş olamaz` };
    lines.push({
      description: description.slice(0, 500),
      productId: i.productId || null,
      quantity,
      unitPrice,
      discount,
      notes: i.notes || null,
      partVariantsData: Array.isArray(i.partVariantsData) && i.partVariantsData.length > 0 ? i.partVariantsData : undefined,
    });
  }

  const totals = invoiceTotals(lines, vatRate);
  return {
    ok: true,
    lines: lines.map((l, k) => ({ ...l, total: totals.lineTotals[k] })),
    vatRate,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
  };
}
