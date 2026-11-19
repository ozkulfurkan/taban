// Tarih alanı dönüşümleri: API biçimi "YYYY-AA-GG", ekranda "GG.AA.YYYY". Saf modül (testli).
// Saat dilimi kayması olmasın diye UTC'ye çevrilmez: cihazın yerel günü kullanılır.

/** "2026-11-25" → yerel gece yarısı Date; geçersizse null */
export function dateFromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Seçilen tarih → "2026-11-25" (cihazın yerel günü) */
export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-11-25" → "25.11.2026" */
export function displayDate(iso: string): string {
  const d = dateFromIso(iso);
  return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : '';
}

/** "25.11.2026" / "25/11/2026" / "5.1.2026" → "2026-11-25"; geçersiz gün/ay ise null */
export function isoFromDisplay(text: string): string | null {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? isoFromDate(d) : null;
}
