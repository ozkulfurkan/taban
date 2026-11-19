export type StockKind = 'product' | 'material';
export type AdjustMode = 'in' | 'out' | 'count';

export type StockItem = { id: string; name: string; code?: string | null; category?: string | null; stock: number; unit: string };

export const KIND_PATH: Record<StockKind, string> = { product: 'products', material: 'materials' };
/** Ürün adet (tam sayı), hammadde kg (3 ondalık) */
export const DECIMALS: Record<StockKind, number> = { product: 0, material: 3 };

// Kg hesaplarında kayan nokta artıklarını temizler (150.5 - 100.2 = 50.300000000000004)
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Düzeltme sonrası stok */
export function nextStock(mode: AdjustMode, qty: number, current: number) {
  if (mode === 'count') return round3(qty);
  return round3(current + (mode === 'in' ? qty : -qty));
}

/** Girilen miktarın geçerliliği; hata mesajı ya da null */
export function validateAdjust(kind: StockKind, mode: AdjustMode, qty: number, current: number): string | null {
  if (!Number.isFinite(qty) || qty < 0 || (mode !== 'count' && qty === 0)) return 'Miktar girin.';
  if (kind === 'product' && !Number.isInteger(qty)) return 'Ürün miktarı tam sayı olmalı.';
  if (mode === 'count' && kind === 'product') return 'Sayım yalnızca hammaddede yapılır.';
  if (mode === 'count' && round3(qty) === round3(current)) return 'Sayılan miktar mevcut stokla aynı.';
  return null;
}

/** Stok API'sine gidecek gövde (ürün: /api/products/:id/stok, hammadde: /api/materials/:id/stok) */
export function adjustBody(kind: StockKind, mode: AdjustMode, qty: number, notes: string) {
  const n = notes.trim() || undefined;
  if (kind === 'product') return { delta: mode === 'out' ? -qty : qty, notes: n };
  if (mode === 'count') return { type: 'stok_guncelleme', absoluteValue: round3(qty), notes: n };
  return { type: mode === 'in' ? 'artirma' : 'azaltma', delta: round3(mode === 'in' ? qty : -qty), notes: n };
}

// Ekstre hareket türlerinin Türkçe karşılığı (ürün ve hammadde ekstresi)
export const MOVE_LABEL: Record<string, string> = {
  satis: 'Satış',
  iade: 'Müşteri iadesi',
  alis: 'Alış',
  alis_iade: 'Tedarikçiye iade',
  fason_transfer: 'Fasoncu transferi',
  stok_ayar: 'Stok düzeltme',
  artirma: 'Stok girişi',
  azaltma: 'Stok çıkışı',
  stok_guncelleme: 'Sayım',
};

/** Miktar gösterimi: binlik nokta, en fazla 3 ondalık (1.250 · 150,5) */
export const formatQty = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(round3(n));
