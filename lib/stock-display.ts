// Stok gösterimi tek yerden: eksi kırmızı, sıfır gri, pozitif normal.
// Sayılar Türkçe biçimde ve binlik ayraçlı ("1.940", "-3", "12,5").

export function fmtQty(n: number | null | undefined, maxFractionDigits = 2): string {
  const v = Number(n ?? 0);
  return (Object.is(v, -0) ? 0 : v).toLocaleString('tr-TR', { maximumFractionDigits: maxFractionDigits });
}

export type StockTone = 'negative' | 'zero' | 'positive';

export function stockTone(n: number | null | undefined): StockTone {
  const v = Number(n ?? 0);
  if (v < -1e-9) return 'negative';
  if (Math.abs(v) <= 1e-9) return 'zero';
  return 'positive';
}

// Metin rengi. positive için çağıran tarafın varsayılan rengi kullanılır.
export function stockTextClass(n: number | null | undefined, positive = 'text-slate-700'): string {
  const tone = stockTone(n);
  return tone === 'negative' ? 'text-red-600' : tone === 'zero' ? 'text-slate-400' : positive;
}
