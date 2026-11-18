// Para hesapları için ortak fonksiyonlar. Faturalar, ödemeler ve bakiyeler
// sunucuda ve ekranda aynı kuralla hesaplansın diye tek yerde tutulur.

/** Kuruş hassasiyetine yuvarlar (0.1 + 0.2 gibi kayan nokta hatalarını da temizler). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Kullanıcıdan gelen tutarı sayıya çevirir. Türkçe ve İngilizce biçimleri kabul eder:
 *   "1.234,56" → 1234.56   "1234,56" → 1234.56   "1,234.56" → 1234.56
 *   "1234.56"  → 1234.56   "1.234.567" → 1234567  12.5 → 12.5
 * Tek nokta ondalık sayılır ("1.234" → 1.234), çünkü sayı alanları değeri böyle gönderir.
 * Sayıya çevrilemeyen değerde NaN döner; çağıran taraf doğrulamalıdır.
 */
export function parseAmount(input: unknown): number {
  if (typeof input === 'number') return input;
  if (input === null || input === undefined) return NaN;
  let s = String(input).trim().replace(/\s/g, '').replace(/[₺$€]|TL|TRY|USD|EUR/gi, '');
  if (s === '') return NaN;
  if (!/^[-+]?[\d.,]+$/.test(s)) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // İkisi de varsa en sağdaki ondalık ayırıcıdır
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    s = (s.match(/,/g)!.length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot !== -1 && s.match(/\./g)!.length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Boş değerde varsayılanı kullanan parseAmount. */
export function parseAmountOr(input: unknown, fallback: number): number {
  if (input === null || input === undefined || input === '') return fallback;
  return parseAmount(input);
}

export type InvoiceLineInput = { quantity: unknown; unitPrice: unknown; discount?: unknown };

/** Kalem tutarı: miktar × birim fiyat × (1 − iskonto%), kuruşa yuvarlanmış. */
export function lineTotal(line: InvoiceLineInput): number {
  const qty = parseAmount(line.quantity);
  const price = parseAmount(line.unitPrice);
  const disc = parseAmountOr(line.discount, 0);
  return round2(qty * price * (1 - disc / 100));
}

/**
 * Fatura toplamları. Her kalem ayrı yuvarlanır, ara toplam kalemlerin toplamıdır,
 * KDV ara toplam üzerinden bir kez yuvarlanır. Tutarlar iade faturasında da pozitiftir;
 * yönü isReturn belirler.
 */
export function invoiceTotals(lines: InvoiceLineInput[], vatRate: number) {
  const lineTotals = lines.map(lineTotal);
  const subtotal = round2(lineTotals.reduce((s, v) => s + v, 0));
  const vatAmount = round2(subtotal * vatRate / 100);
  return { lineTotals, subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

/**
 * Faturanın müşteri bakiyesine etkisi: satış borcu artırır, iade azaltır.
 * Eski kayıtlarda iade tutarı negatif saklanmış olabileceği için mutlak değer alınır.
 */
export function invoiceBalanceEffect(inv: { total: number; isReturn?: boolean | null }): number {
  const amount = Math.abs(inv.total ?? 0);
  return inv.isReturn ? -amount : amount;
}

// Alışın tedarikçi borcuna etkisi: alış artırır, alış iadesi azaltır.
export const purchaseBalanceEffect = invoiceBalanceEffect;

/** Ödemenin müşteri bakiyesine etkisi (borç fişi ve "+" bakiye düzeltmesi borcu artırır). */
export function paymentBalanceEffect(p: { amount: number; method?: string | null; notes?: string | null }): number {
  const increasesDebt = p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && !!p.notes?.startsWith('+'));
  return increasesDebt ? p.amount : -p.amount;
}

export const CURRENCIES = ['TRY', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (c: unknown): c is Currency => typeof c === 'string' && (CURRENCIES as readonly string[]).includes(c);

/**
 * Müşteri bakiyesi: satışlar − iadeler − tahsilatlar − çekler (+ borç fişleri).
 * Müşteri listesi, müşteri detayı ve ekstre aynı sonucu versin diye tek yerde.
 */
export function customerBalance(
  invoices: Array<{ total: number; isReturn?: boolean | null }>,
  payments: Array<{ amount: number; method?: string | null; notes?: string | null }>,
  cekler: Array<{ tutar: number; customerAmount?: number | null }> = [],
) {
  let totalInvoiced = 0, totalReturned = 0, totalPaid = 0, totalCek = 0, debtAdjustments = 0;
  for (const inv of invoices) {
    if (inv.isReturn) totalReturned += Math.abs(inv.total ?? 0);
    else totalInvoiced += Math.abs(inv.total ?? 0);
  }
  for (const p of payments) {
    const effect = paymentBalanceEffect(p);
    if (effect > 0) debtAdjustments += effect;
    else totalPaid += -effect;
  }
  for (const c of cekler) totalCek += c.customerAmount ?? c.tutar;
  const balance = round2(totalInvoiced - totalReturned + debtAdjustments - totalPaid - totalCek);
  return {
    totalInvoiced: round2(totalInvoiced),
    totalReturned: round2(totalReturned),
    totalPaid: round2(totalPaid + totalCek),
    totalCek: round2(totalCek),
    balance,
  };
}
