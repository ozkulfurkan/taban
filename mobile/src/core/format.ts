// Türkçe sayı ve tarih biçimleri (web uygulamasıyla aynı)
export const fmt = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n: number | null | undefined, currency = 'TRY') => `${fmt(n)} ${currency}`;

export function formatDate(value?: string | Date | number | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** yyyy-mm-dd (İstanbul saatine göre) */
export function isoDay(d: Date = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

export function yearAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return isoDay(d);
}
