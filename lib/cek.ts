// Çek portföyü yardımcıları (sunucu ve arayüz ortak).
import { tryPer, type Rates } from './fx';

export const ACTIVE_CEK_DURUM = ['PORTFOY', 'BANKAYA_VERILDI'] as const;
const DAY = 86400000;

// Vadeye kalan gün (bugün = 0, geçmiş = eksi). Gün sınırı yerel saate göre.
export function daysToVade(vadesi: string | Date, now: Date = new Date()): number {
  const v = new Date(vadesi);
  const a = Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY);
}

export type VadeTone = 'overdue' | 'soon' | 'normal';

// Sadece hâlâ tahsil bekleyen çekler renklenir
export function vadeTone(cek: { vadesi: string | Date; durum: string }, now: Date = new Date()): VadeTone {
  if (!(ACTIVE_CEK_DURUM as readonly string[]).includes(cek.durum)) return 'normal';
  const d = daysToVade(cek.vadesi, now);
  if (d < 0) return 'overdue';
  if (d <= 7) return 'soon';
  return 'normal';
}

// Tutar ağırlıklı ortalama vade. Farklı dövizler TL karşılığıyla ağırlıklandırılır;
// kur bilinmiyorsa tutar olduğu gibi kullanılır.
export function weightedAvgVade(cekler: Array<{ tutar: number; currency?: string | null; vadesi: string | Date }>, rates: Rates = {}, now: Date = new Date()) {
  let wSum = 0, tSum = 0;
  for (const c of cekler) {
    const w = Number(c.tutar) * (tryPer(c.currency || 'TRY', rates) ?? 1);
    wSum += w;
    tSum += w * new Date(c.vadesi).getTime();
  }
  if (!(wSum > 0)) return null;
  const date = new Date(tSum / wSum);
  return { date, days: daysToVade(date, now) };
}

// Döviz bazında toplam
export function totalsByCurrency(cekler: Array<{ tutar: number; currency?: string | null }>) {
  const m = new Map<string, { currency: string; count: number; total: number }>();
  for (const c of cekler) {
    const cur = c.currency || 'TRY';
    const e = m.get(cur) ?? { currency: cur, count: 0, total: 0 };
    e.count += 1;
    e.total = Math.round((e.total + Number(c.tutar)) * 100) / 100;
    m.set(cur, e);
  }
  return Array.from(m.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}
