// Tahsilat / ödeme kaydı (ekran tarafı). Kayıt carinin hesabına işlenir; fatura veya alışa bağlanmaz.
export async function postPayment(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; cancelled?: boolean }> {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || 'Ödeme kaydedilemedi' };
  }
  return { ok: true };
}
