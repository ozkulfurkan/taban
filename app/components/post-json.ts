// Kayıt isteği: yanıt başarısızsa sunucunun mesajıyla hata fırlatır (ekran "kaydedildi" sanıp kapanmasın).
// 409 (mükerrer kayıt koruması, lib/request-dedup.ts) da hata olarak döner.
export async function postJson<T = any>(url: string, body: unknown, method: 'POST' | 'PATCH' | 'PUT' = 'POST'): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
  return data as T;
}

/** Kayıt hatasını kullanıcıya gösterir */
export function showSaveError(e: unknown) {
  console.error(e);
  window.alert(e instanceof Error ? e.message : 'Kaydedilemedi');
}
