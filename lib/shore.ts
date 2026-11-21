// Hammadde (çift dışı birim) siparişlerinde renk yerine shore (sertlik) bilgisi.
// Seviye (Yumuşak / Standart / Sert) + değer (varsayılan 65, ±2 tolerans). Saf modül: web, sunucu ve mobil (@shared/shore).
import { isPairUnit } from './order-units';

export const SHORE_LEVELS = ['Yumuşak', 'Standart', 'Sert'] as const;
export type ShoreLevel = (typeof SHORE_LEVELS)[number];
export const DEFAULT_SHORE_LEVEL: ShoreLevel = 'Standart';
export const DEFAULT_SHORE_VALUE = 65;
export const SHORE_TOLERANCE = 2;
export const SHORE_NOTE = `Shore değeri ±${SHORE_TOLERANCE} oynayabilir.`;

export type ShoreFields = { shoreLevel?: string | null; shoreValue?: number | null };

/** Formdan gelen shore bilgisini doğrular: seviye listeden, değer 0–100 tam sayı (boşsa 65) */
export function cleanShore(level: unknown, value: unknown): { shoreLevel: ShoreLevel; shoreValue: number } | { error: string } {
  const shoreLevel = (SHORE_LEVELS as readonly string[]).includes(String(level)) ? (level as ShoreLevel) : DEFAULT_SHORE_LEVEL;
  const raw = value === undefined || value === null || value === '' ? DEFAULT_SHORE_VALUE : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(raw) || raw < 0 || raw > 100 || Math.round(raw) !== raw) return { error: 'Shore değeri 0–100 arası tam sayı olmalı' };
  return { shoreLevel, shoreValue: raw };
}

/** "Standart · 65 Shore (±2)"; shore bilgisi yoksa boş */
export function shoreText(i: ShoreFields) {
  if (!i.shoreLevel && (i.shoreValue === null || i.shoreValue === undefined)) return '';
  const parts = [i.shoreLevel, i.shoreValue !== null && i.shoreValue !== undefined ? `${i.shoreValue} Shore (±${SHORE_TOLERANCE})` : ''].filter(Boolean);
  return parts.join(' · ');
}

/** Kalemin renk/shore sütunu: tabanda renk, hammaddede shore (eski kayıtlarda renk) */
export function variantText(i: ShoreFields & { color?: string | null; unit?: string | null }) {
  if (isPairUnit(i.unit)) return i.color || '';
  return shoreText(i) || i.color || '';
}

/** Sütun başlığı: tabanda "Renk", hammaddede "Shore" */
export const variantLabel = (unit?: string | null) => (isPairUnit(unit) ? 'Renk' : 'Shore');
