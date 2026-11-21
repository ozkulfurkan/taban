// Borç / alacak fişi (web'deki fişle aynı kayıt biçimi). Saf modül: test edilebilir.
export type FeeKind = 'Borç Fişi' | 'Alacak Fişi';

/** Bakiyeye etkisi: borç fişi bakiyeyi artırır, alacak fişi azaltır (lib/money paymentBalanceEffect ile aynı) */
export const feeEffect = (kind: FeeKind, amount: number) => (kind === 'Borç Fişi' ? amount : -amount);

/** Notlar: "Vade:YYYY-AA-GG | açıklama" (web ile aynı); boşsa null */
export function feeNotes(due: string, notes: string): string | null {
  const parts = [/^\d{4}-\d{2}-\d{2}$/.test(due) ? `Vade:${due}` : '', notes.trim()].filter(Boolean);
  return parts.length ? parts.join(' | ') : null;
}
