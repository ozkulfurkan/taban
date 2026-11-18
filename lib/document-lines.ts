// Satış, iade ve alış belgelerinin ortak kalem modeli ve tutar hesapları.
// Ekrandaki girişler Türkçe biçimde tutulur ("12,50"); hesaplarda sayıya çevrilir.
import { fromPriceInput, toPriceInput } from './price-input';
import { round2 } from './money';

export type DocKind = 'sale' | 'return' | 'purchase';
export type LineType = 'product' | 'material' | 'free';

export interface DocLine {
  key: string;
  itemType: LineType;
  productId?: string;
  materialId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string; // yüzde
  notes: string;
  partVariantsData?: Array<{ partId: string; materialId: string }>;
}

let seq = 0;
export const newLineKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyLine(prefill: Partial<DocLine> = {}): DocLine {
  return { key: newLineKey(), itemType: 'free', description: '', quantity: '1', unitPrice: '', discount: '0', notes: '', ...prefill };
}

export function lineGross(l: Pick<DocLine, 'quantity' | 'unitPrice'>) {
  return fromPriceInput(l.quantity) * fromPriceInput(l.unitPrice);
}

export function lineNet(l: Pick<DocLine, 'quantity' | 'unitPrice' | 'discount'>) {
  return round2(lineGross(l) * (1 - fromPriceInput(l.discount || '0') / 100));
}

export function docTotals(lines: DocLine[], vatRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + lineNet(l), 0));
  const vatAmount = round2(subtotal * (vatRate || 0) / 100);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

// Kayıtlı fatura kalemini ekran satırına çevirir
export function lineFromInvoiceItem(i: any): DocLine {
  return {
    key: newLineKey(),
    itemType: i.productId ? 'product' : 'free',
    productId: i.productId || undefined,
    description: i.description ?? '',
    quantity: toPriceInput(i.quantity),
    unitPrice: toPriceInput(i.unitPrice),
    discount: toPriceInput(i.discount ?? 0),
    notes: i.notes ?? '',
    partVariantsData: Array.isArray(i.partVariantsData) && i.partVariantsData.length ? i.partVariantsData : undefined,
  };
}

// Kayıtlı alış kalemini (PurchaseMaterial) ekran satırına çevirir
export function lineFromPurchaseMaterial(pm: any): DocLine {
  const isProduct = !!pm.productId;
  const name = isProduct
    ? (pm.product ? `${pm.product.name}${pm.product.code ? ` [${pm.product.code}]` : ''}` : 'Ürün')
    : (pm.material?.name ?? 'Hammadde');
  return {
    key: newLineKey(),
    itemType: isProduct ? 'product' : 'material',
    productId: pm.productId || undefined,
    materialId: pm.materialId || undefined,
    description: name,
    quantity: toPriceInput(pm.kgAmount),
    unitPrice: toPriceInput(pm.pricePerKg ?? ''),
    discount: '0',
    notes: '',
  };
}

// API gövdeleri
export function invoiceItemsPayload(lines: DocLine[]) {
  return lines.map(l => ({
    productId: l.productId || null,
    description: l.description,
    quantity: fromPriceInput(l.quantity),
    unitPrice: fromPriceInput(l.unitPrice),
    discount: fromPriceInput(l.discount || '0'),
    notes: l.notes || null,
    partVariantsData: l.partVariantsData ?? null,
  }));
}

export function purchaseItemsPayload(lines: DocLine[], subcontractorId?: string) {
  return lines.map(l => ({
    productId: l.itemType === 'product' ? l.productId || null : null,
    materialId: l.itemType === 'material' ? l.materialId || null : null,
    subcontractorId: l.itemType === 'material' && subcontractorId ? subcontractorId : null,
    description: l.description,
    qty: fromPriceInput(l.quantity),
    unitPrice: fromPriceInput(l.unitPrice),
  }));
}

// Kaydetmeden önce satır kontrolü; hata metni ya da null
export function lineProblem(kind: DocKind, l: DocLine, index: number): string | null {
  const n = index + 1;
  if (!(fromPriceInput(l.quantity) > 0)) return `${n}. kalem: miktar 0'dan büyük olmalı`;
  if (!(fromPriceInput(l.unitPrice) >= 0)) return `${n}. kalem: birim fiyat geçersiz`;
  if (kind === 'purchase' && !(l.productId || l.materialId)) return `${n}. kalem: ürün ya da hammadde seçin`;
  if (kind !== 'purchase' && !l.description.trim()) return `${n}. kalem: açıklama girin`;
  const d = fromPriceInput(l.discount || '0');
  if (d < 0 || d > 100) return `${n}. kalem: iskonto 0-100 arasında olmalı`;
  return null;
}
