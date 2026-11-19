import { convertAmount, type Rates } from '@shared/fx';
import { round2 } from '@shared/money';

// Mobil çek portföyü kuralları. Sunucu (/api/cek/bulk) aynı durum kurallarını uygular;
// burada yalnızca uygun olmayan işlemi baştan göstermemek için kullanılır.

export type Cek = {
  id: string;
  borclu: string;
  bankasi?: string | null;
  seriNo?: string | null;
  tutar: number;
  currency: string;
  vadesi: string;
  islemTarihi?: string;
  durum: string;
  islem?: string | null;
  aciklama?: string | null;
  customerAmount?: number | null;
  customer?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  bankAccount?: { id: string; name: string; currency: string } | null;
};

export type BulkAction = 'bank' | 'supplier' | 'collect';

export const DURUM_LABEL: Record<string, string> = {
  PORTFOY: 'Portföyde',
  BANKAYA_VERILDI: 'Bankada',
  TEDARIKCI_VERILDI: 'Tedarikçide',
  ODENDI: 'Ödendi',
  KARSILIKSIZ: 'Karşılıksız',
  KARSILIKS: 'Karşılıksız',
  IPTAL: 'İptal',
};

/** Seçili çeklere uygulanabilecek işlemler (sunucudaki ALLOWED_FROM ile aynı) */
export function availableActions(cekler: Pick<Cek, 'durum'>[]): Record<BulkAction, boolean> {
  const any = cekler.length > 0;
  const allPortfoy = any && cekler.every(c => c.durum === 'PORTFOY');
  const collectable = any && cekler.every(c => c.durum === 'PORTFOY' || c.durum === 'BANKAYA_VERILDI');
  return { bank: allPortfoy, supplier: allPortfoy, collect: collectable };
}

/** Tahsilde kullanılacak hesabın dövizi: seçili çeklerin hepsi aynı dövizde olmalı */
export function singleCurrency(cekler: Pick<Cek, 'currency'>[]): string | null {
  const set = new Set(cekler.map(c => c.currency || 'TRY'));
  return set.size === 1 ? Array.from(set)[0] : null;
}

/** Tedarikçiye verirken çeklerin tedarikçi dövizindeki önerilen karşılığı (TCMB kuru) */
export function suggestedSupplierAmounts(cekler: Pick<Cek, 'id' | 'tutar' | 'currency'>[], supplierCurrency: string, rates: Rates) {
  const out: Record<string, number | null> = {};
  for (const c of cekler) {
    out[c.id] = (c.currency || 'TRY') === supplierCurrency
      ? round2(c.tutar)
      : (() => { const v = convertAmount(c.tutar, c.currency || 'TRY', supplierCurrency, rates); return v == null ? null : round2(v); })();
  }
  return out;
}

/** /api/cek/bulk gövdesi */
export function bulkBody(action: BulkAction, ids: string[], opts: {
  accountId?: string | null; supplierId?: string | null; date?: string; note?: string; amounts?: Record<string, number>;
}) {
  const base = { action, ids, date: opts.date, note: opts.note?.trim() || undefined };
  if (action === 'supplier') {
    return { ...base, supplierId: opts.supplierId, items: ids.map(id => ({ id, amount: opts.amounts?.[id] })) };
  }
  return { ...base, accountId: opts.accountId };
}
