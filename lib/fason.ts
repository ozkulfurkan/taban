// Fason (fasoncu) iş kuralları: numara dağılımı, durum geçişleri, sevk kaydı ve hammadde tüketimi.
import type { Prisma } from '@prisma/client';

export const SHIP_NOTE = 'Ürünler sevk edildi.';
/** Kapanmış siparişte hammadde gönderilmez, fire girilmez, teslim alınmaz */
export const CLOSED_STATUSES = ['RECEIVED', 'CANCELLED'] as const;
export const isClosed = (status: string) => (CLOSED_STATUSES as readonly string[]).includes(status);

const ALL_STATUSES = ['PENDING', 'MATERIAL_SENT', 'IN_PRODUCTION', 'IN_PROGRESS', 'COMPLETED', 'RECEIVED', 'CANCELLED'] as const;

/**
 * Firma tarafında elle durum değişikliği. "Teslim Alındı" yalnızca teslim alma işlemiyle olur (stok ve zimmet
 * birlikte işlenir); teslim alınmış sipariş başka duruma geçmez; iptal edilen yalnızca "Bekliyor"a geri döner.
 */
export function firmStatusError(from: string, to: unknown): string | null {
  if (typeof to !== 'string' || !(ALL_STATUSES as readonly string[]).includes(to)) return 'Geçersiz durum';
  if (to === from) return null;
  if (to === 'RECEIVED') return 'Teslim alma için "Teslim Al" işlemini kullanın';
  if (from === 'RECEIVED') return 'Teslim alınmış siparişin durumu değiştirilemez';
  if (from === 'CANCELLED' && to !== 'PENDING') return 'İptal edilen sipariş yalnızca geri alınabilir';
  return null;
}

/** Numara dağılımı: pozitif tam sayılar; boş ya da toplamı 0 olan dağılım hata */
export function cleanSizeDistribution(raw: unknown): { sizes: Record<string, number>; total: number } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Numara dağılımı gerekli' };
  const sizes: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim().slice(0, 10);
    if (v === '' || v === null || v === undefined || Number(v) === 0) continue;
    const n = Number(v);
    if (!key || !Number.isInteger(n) || n < 0) return { error: `${key || 'Numara'}: adet pozitif tam sayı olmalı` };
    if (n > 1_000_000) return { error: `${key}: adet çok büyük` };
    sizes[key] = n;
  }
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  if (!total) return { error: 'En az bir numaraya adet girin' };
  return { sizes, total };
}

/** Reçeteye göre hammadde ihtiyacı (kg): gram × (1 + fire%) × çift / 1000 */
export const kgFor = (part: { gramsPerPiece: number; wasteRate: number }, pairs: number) =>
  (part.gramsPerPiece * (1 + part.wasteRate / 100) * pairs) / 1000;

/** Teslim alınan çift için reçetedeki hammaddeyi fasoncu zimmetinden düşer (zimmet eksiye inmez) */
export async function consumeFromSubcontractorStock(
  tx: Prisma.TransactionClient,
  subcontractorId: string,
  parts: { materialId: string | null; gramsPerPiece: number; wasteRate: number }[],
  pairs: number,
) {
  if (!pairs) return;
  for (const part of parts) {
    if (!part.materialId) continue;
    const kg = kgFor(part, pairs);
    const ss = await tx.subcontractorStock.findFirst({ where: { subcontractorId, materialId: part.materialId } });
    if (ss) await tx.subcontractorStock.update({ where: { id: ss.id }, data: { quantity: Math.max(0, ss.quantity - kg) } });
  }
}

/** Fasoncunun bildirdiği üretilen (toplam) çift: 0 … sipariş adedi arası tam sayı */
export function completedPairsError(value: unknown, totalPairs: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return 'Üretilen adet 0 veya pozitif tam sayı olmalı';
  if (n > totalPairs) return `Üretilen adet sipariş adedini (${totalPairs}) geçemez`;
  return null;
}
