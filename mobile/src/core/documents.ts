import { invoiceTotals, round2 } from '@shared/money';
import { parseAmountInput } from './amount';

// Mobil belge formu: satış, satış iadesi, alış, tedarikçiye iade.
// Tutarlar sunucudaki hesapla aynı fonksiyondan (lib/money invoiceTotals) gelir.

export type DocKind = 'sale' | 'return' | 'purchase' | 'purchaseReturn';
export const isPurchaseKind = (k: DocKind) => k === 'purchase' || k === 'purchaseReturn';
export const isReturnKind = (k: DocKind) => k === 'return' || k === 'purchaseReturn';

export const DOC_TITLE: Record<DocKind, string> = {
  sale: 'Yeni Satış',
  return: 'Müşteriden İade',
  purchase: 'Yeni Alış',
  purchaseReturn: 'Tedarikçiye İade',
};

export type LineType = 'product' | 'material' | 'free';
export type FormLine = {
  key: string;
  type: LineType;
  productId?: string;
  materialId?: string;
  code?: string;
  description: string;
  quantity: string;  // ekrandaki Türkçe biçim ("1.250,5")
  unitPrice: string;
  discount: string;  // yüzde
};

let seq = 0;
export const lineKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

export function totalsOf(lines: FormLine[], vatRate: number) {
  return invoiceTotals(
    lines.map(l => ({ quantity: parseAmountInput(l.quantity), unitPrice: parseAmountInput(l.unitPrice), discount: parseAmountInput(l.discount) })),
    vatRate,
  );
}

/** Satış / iade faturası gövdesi (/api/invoices) */
export function invoiceBody(p: {
  kind: DocKind; customerId: string; currency: string; date: string; dueDate: string; vatRate: number; notes: string; lines: FormLine[];
}) {
  return {
    customerId: p.customerId,
    currency: p.currency,
    isReturn: p.kind === 'return',
    date: p.date,
    dueDate: p.kind === 'sale' && p.dueDate ? p.dueDate : undefined,
    vatRate: p.vatRate,
    notes: p.notes.trim() || null,
    items: p.lines.map(l => ({
      description: l.description.trim(),
      productId: l.type === 'product' ? l.productId : null,
      quantity: parseAmountInput(l.quantity),
      unitPrice: parseAmountInput(l.unitPrice),
      discount: parseAmountInput(l.discount),
    })),
  };
}

/** Alış / tedarikçiye iade gövdesi (/api/purchases) */
export function purchaseBody(p: { kind: DocKind; supplierId: string; currency: string; date: string; notes: string; lines: FormLine[] }) {
  return {
    supplierId: p.supplierId,
    currency: p.currency,
    isReturn: p.kind === 'purchaseReturn',
    date: p.date,
    notes: p.notes.trim() || null,
    items: p.lines.map(l => ({
      productId: l.type === 'product' ? l.productId : undefined,
      materialId: l.type === 'material' ? l.materialId : undefined,
      qty: parseAmountInput(l.quantity),
      unitPrice: parseAmountInput(l.unitPrice),
    })),
  };
}

/** Kaydetmeden önce ekranda gösterilecek hata (sunucu da aynı kuralları uygular) */
export function validateLines(kind: DocKind, lines: FormLine[]): string | null {
  if (lines.length === 0) return 'En az bir kalem ekleyin.';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const n = `${i + 1}. kalem`;
    if (!(parseAmountInput(l.quantity) > 0)) return `${n}: miktar girin.`;
    if (isPurchaseKind(kind) && l.type === 'free') return `${n}: ürün ya da hammadde seçin.`;
    if (!l.description.trim()) return `${n}: açıklama girin.`;
    const d = parseAmountInput(l.discount);
    if (d < 0 || d > 100) return `${n}: iskonto %0 ile %100 arasında olmalı.`;
  }
  if (isPurchaseKind(kind) && !(round2(totalsOf(lines, 0).subtotal) > 0)) return 'Alış toplamı 0 olamaz.';
  return null;
}
