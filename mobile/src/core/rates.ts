// Ana sayfa başlığındaki kur satırı: "USD 38,52 · EUR 42,10"
const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function homeRates(
  tcmb: { usd?: number; eur?: number } | null,
  saved: { usdToTry?: number; eurToTry?: number } | null,
): string | null {
  if (tcmb?.usd && tcmb?.eur) return `USD ${fmt(tcmb.usd)} · EUR ${fmt(tcmb.eur)}`;
  if (saved?.usdToTry && saved?.eurToTry) return `USD ${fmt(saved.usdToTry)} · EUR ${fmt(saved.eurToTry)} (kayıtlı)`;
  return null;
}
