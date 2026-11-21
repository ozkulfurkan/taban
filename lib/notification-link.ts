// Bildirim adresi (saf modül, testli): bildirimler mobil uygulamanın ekran yoluyla saklanır,
// web'de aynı kaydın karşılığı olan sayfa buradan çıkarılır. Bilinmeyen yol için null döner.

const RULES: Array<[RegExp, (id: string) => string, 'staff' | 'portal']> = [
  [/^\/siparis\/gelen\/([^/?#]+)$/, id => `/orders/${id}`, 'staff'],
  [/^\/siparis\/verilen\/([^/?#]+)$/, id => `/verilen-siparisler/${id}`, 'staff'],
  [/^\/siparisler\/([^/?#]+)$/, id => `/portal/orders/${id}`, 'portal'],
];

export function webUrlOf(url: string | null | undefined, portal: boolean): string | null {
  if (!url) return null;
  for (const [re, to, who] of RULES) {
    const m = re.exec(url);
    if (m && (who === 'portal') === portal) return to(encodeURIComponent(decodeURIComponent(m[1])));
  }
  return null;
}

/** Liste için kısa zaman metni: "az önce", "5 dk", "3 sa", "2 gün", sonra tarih */
export function timeAgo(date: string | Date, now = new Date()): string {
  const d = new Date(date);
  const s = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dk`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} gün`;
  return d.toLocaleDateString('tr-TR');
}
