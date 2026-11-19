// Personel: hesap hareket türleri ve bakiye (web ile aynı muhasebe kuralı)
// Hakediş / Prim: personel hak kazandı → alacak (bakiye artar, borcumuz artar)
// Maaş / Avans: nakit ödeme → borç (bakiye düşer); Kesinti: personel borçlandı → borç
export type Employee = {
  id: string; name: string; department: string; role: string; salary: number; currency: string;
  status: 'active' | 'left'; hireDate: string; payday: number; phone?: string | null; email?: string | null; notes?: string | null;
  balance?: number; lastPaymentDate?: string | null;
};
export type LedgerEntry = { id: string; date: string; type: string; description?: string | null; debit: number; credit: number; account?: string | null };

export const LEDGER_TYPES = ['Maaş', 'Avans', 'Hakediş', 'Prim', 'Kesinti'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

/** Kasadan / bankadan ödeme çıkan türler (hesap seçilir) */
export const isCashPayment = (t: string) => t === 'Maaş' || t === 'Avans';

/** Bakiye: alacak − borç (pozitif = personele borcumuz var) */
export const ledgerBalance = (rows: Pick<LedgerEntry, 'debit' | 'credit'>[]) =>
  Math.round(rows.reduce((s, r) => s + (r.credit || 0) - (r.debit || 0), 0) * 100) / 100;

export function balanceNote(balance: number) {
  if (Math.abs(balance) < 0.005) return 'Hesap kapalı';
  return balance > 0 ? 'Personele borcunuz' : 'Personelin size borcu';
}
