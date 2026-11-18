// Döviz çevirme: TCMB satış kurları (1 USD / 1 EUR kaç TL) üzerinden çapraz kur.
import { round2 } from './money';

export type Rates = { usd?: number | null; eur?: number | null };

// 1 birim dövizin TL karşılığı; bilinmiyorsa null
export function tryPer(currency: string, rates: Rates): number | null {
  if (currency === 'TRY') return 1;
  const r = currency === 'USD' ? rates.usd : currency === 'EUR' ? rates.eur : null;
  return r && r > 0 ? r : null;
}

// 1 birim `from` kaç `to` eder
export function crossRate(from: string, to: string, rates: Rates): number | null {
  if (from === to) return 1;
  const a = tryPer(from, rates);
  const b = tryPer(to, rates);
  if (a == null || b == null) return null;
  return a / b;
}

export function convertAmount(amount: number, from: string, to: string, rates: Rates): number | null {
  const r = crossRate(from, to, rates);
  return r == null ? null : round2(amount * r);
}
