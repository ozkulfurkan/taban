// Sipariş birimleri: taban (çift) beden asortisiyle, diğerleri miktarla sipariş edilir.
// Saf modül: web, sunucu ve mobil (@shared/order-units) aynı kuralı kullanır.

/** Ondalıklı miktar alan birimler (en fazla 3 ondalık) */
export const DECIMAL_UNITS = ['kg', 'ton', 'lt', 'metre'];

/** Birim boş ya da "çift" ise beden asortisiyle sipariş edilir */
export const isPairUnit = (unit?: string | null) => !unit || unit.trim().toLocaleLowerCase('tr') === 'çift';

export const unitDecimals = (unit?: string | null) => (unit && DECIMAL_UNITS.includes(unit.trim().toLocaleLowerCase('tr')) ? 3 : 0);

export const orderUnit = (unit?: string | null) => (isPairUnit(unit) ? 'çift' : unit!.trim());

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/** Birime göre geçerli miktar; geçersizse null (ondalıklı birimde 3 haneye yuvarlar, diğerlerinde tam sayı şartı) */
export function cleanQuantity(value: unknown, unit?: string | null): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/\./g, '').replace(',', '.')) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = unitDecimals(unit);
  if (d === 0 && !Number.isInteger(n)) return null;
  const r = round(n, d);
  return r > 0 ? r : null;
}

/** "1.250,5 kg" · "36 çift" */
export function formatQty(n: number | null | undefined, unit?: string | null) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${orderUnit(unit)}`;
}
