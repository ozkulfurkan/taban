// Sipariş kataloğu yardımcıları (saf, testli; web, sunucu ve mobil @shared/catalog-history):
// - Alıcının daha önce aldığı ürünleri en üste alan sıralama (satıcıdaki siparişler + faturalar)
// - Alıcının hammaddesine satıcı kataloğundan ad / kod benzerliğiyle eşleşme önerisi

export type PurchaseRecord = { productId: string | null | undefined; at: Date | string };
export type PurchaseStat = { count: number; lastAt: string };

/** Alım kayıtlarından ürün başına adet ve son alım tarihi */
export function historyFromRecords(records: PurchaseRecord[]): Map<string, PurchaseStat> {
  const m = new Map<string, PurchaseStat>();
  for (const r of records) {
    if (!r.productId) continue;
    const at = new Date(r.at).toISOString();
    const s = m.get(r.productId);
    if (!s) m.set(r.productId, { count: 1, lastAt: at });
    else { s.count++; if (at > s.lastAt) s.lastAt = at; }
  }
  return m;
}

/** Daha önce alınanlar üstte (son alım ↓, adet ↓), diğerleri ada göre; her ürüne purchased eklenir */
export function sortByHistory<T extends { id: string; name: string }>(products: T[], history: Map<string, PurchaseStat>) {
  return products
    .map(p => ({ ...p, purchased: history.get(p.id) ?? null }))
    .sort((a, b) => {
      if (a.purchased && b.purchased) {
        return b.purchased.lastAt.localeCompare(a.purchased.lastAt) || b.purchased.count - a.purchased.count || a.name.localeCompare(b.name, 'tr');
      }
      if (a.purchased) return -1;
      if (b.purchased) return 1;
      return a.name.localeCompare(b.name, 'tr');
    });
}

// Eşleştirme: "PU Sistem (Poliol + İzosiyanat)" ↔ "PU Taban Sistemi Shore 60" gibi adları kelime / kod örtüşmesiyle puanlar
const STOP = new Set(['ve', 've/', 'ile', 'için', 'granül', 'hamuru', 'pasta', 'kg', 'adet']);
// Yalnızca Türkçe/ASCII harf ve rakam (Unicode özellik kaçışları mobil JS motorunda garanti değil)
const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[^a-z0-9çğiöşü]+/g, ' ').trim();
const tokens = (s: string) => new Set(norm(s).split(' ').filter(t => t.length >= 2 && !STOP.has(t)));

export function matchScore(materialName: string, product: { name: string; code?: string | null }) {
  const a = tokens(materialName);
  const b = tokens(`${product.name} ${product.code ?? ''}`);
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of Array.from(a)) {
    // tam kelime ya da ön ek (ör. "tpu" ↔ "tpu85", "termo" ↔ "termoplastik")
    if (b.has(t) || Array.from(b).some(x => (x.length >= 3 && t.length >= 3) && (x.startsWith(t) || t.startsWith(x)))) hit++;
  }
  return hit / a.size;
}

/** En olası satıcı ürünü; benzerlik yoksa null */
export function suggestMatch<T extends { id: string; name: string; code?: string | null }>(materialName: string, catalog: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const p of catalog) {
    const s = matchScore(materialName, p);
    if (s > bestScore) { best = p; bestScore = s; }
  }
  return bestScore >= 0.34 ? best : null;
}
