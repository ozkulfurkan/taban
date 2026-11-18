// Ödeme kaydı (ekran tarafı). Sunucu fazla ödemede onay ister (409 OVERPAYMENT):
// kullanıcıya sorulur, onaylarsa aynı istek allowOverpayment ile tekrar gönderilir.
export async function postPayment(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; cancelled?: boolean }> {
  const send = (extra: Record<string, unknown> = {}) =>
    fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...extra }),
    });

  let res = await send();
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    if (data?.code === 'OVERPAYMENT') {
      const remaining = Number(data.remaining ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const ok = window.confirm(
        `${data.error}\nKalan tutar: ${remaining} ${data.currency ?? ''}\n\n` +
        'Yine de kaydedilsin mi? Fazla kısım müşterinin/tedarikçinin bakiyesine alacak olarak yansır.',
      );
      if (!ok) return { ok: false, cancelled: true };
      res = await send({ allowOverpayment: true });
    } else {
      return { ok: false, error: data?.error || 'Ödeme kaydedilemedi' };
    }
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || 'Ödeme kaydedilemedi' };
  }
  return { ok: true };
}
