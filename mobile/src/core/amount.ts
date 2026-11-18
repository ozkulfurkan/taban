// Tutar alanı: yazarken Türkçe biçime çevrilir (binlik nokta, ondalık virgül), böylece
// "3.500" hep üç bin beş yüz demektir. Klavyenin ondalık tuşu nokta ise virgüle çevrilir.

const group = (digits: string) => digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function formatAmountInput(raw: string, maxDecimals = 2): string {
  let s = (raw || '').replace(/[^\d.,]/g, '');
  if (!s) return '';
  if (!s.includes(',')) {
    const dots = s.split('.').length - 1;
    // Sonda tek nokta (ondalık tuşu) ya da "3500.25" gibi yapıştırılmış ondalık → virgül
    if (s.endsWith('.') && dots === 1) s = s.slice(0, -1) + ',';
    else if (dots === 1 && /^\d+\.\d{1,2}$/.test(s)) s = s.replace('.', ',');
  }
  const comma = s.indexOf(',');
  const intPart = (comma === -1 ? s : s.slice(0, comma)).replace(/\./g, '');
  if (comma === -1) return group(intPart);
  const dec = s.slice(comma + 1).replace(/[.,]/g, '').slice(0, maxDecimals);
  return `${group(intPart) || '0'},${dec}`;
}

/** formatAmountInput çıktısını sayıya çevirir: "3.500,25" → 3500.25 */
export function parseAmountInput(s: string): number {
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
