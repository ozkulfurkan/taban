// Türkçe karakterden bağımsız arama.
// JavaScript'in toLowerCase() ve Postgres'in ILIKE'ı Türkçe I/ı ve İ/i dönüşümünü bilmez:
// "ışık" araması "IŞIK"ı bulamaz. Burada iki taraf da Türkçe kurala göre küçültülüp
// sadeleştirilir; "isik", "ışık", "Işık", "IŞIK" hepsi aynı sonucu verir.

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function foldTr(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('tr')
    .normalize('NFD').replace(/[̇]/g, '') // "İ".toLowerCase() bazı ortamlarda i + nokta işareti verir
    .normalize('NFC')
    .replace(/[çğıöşüâîû]/g, c => FOLD[c] ?? c)
    .trim();
}

/** Metin, aranan ifadeyi Türkçe karakterden bağımsız olarak içeriyor mu? */
export function matchesText(text: unknown, query: unknown): boolean {
  return foldTr(text).includes(foldTr(query));
}

/**
 * Postgres tarafında aynı sadeleştirme için SQL ifadesi (raw sorgularda kullanılır).
 * Önce Türkçe büyük harfler çevrilir, sonra lower() ve kalan Türkçe harfler sadeleştirilir.
 */
export function foldSql(column: string): string {
  return `translate(lower(translate(${column}, 'İIÇĞÖŞÜ', 'iıçğöşü')), 'çğıöşüâîû', 'cgiosuaiu')`;
}
