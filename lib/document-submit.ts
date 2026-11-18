// Belge ekranından API'ye gönderim. Satış, iade ve alış (yeni / düzenleme) aynı yoldan geçer.
import type { DocHeader } from '@/app/components/document-editor';

type Result = { ok: true; id: string } | { ok: false; error: string };

// Tarih ve saat tarayıcının saatine göre birleştirilir (eski ekranlarla aynı davranış)
export function headerDateIso(h: Pick<DocHeader, 'date' | 'time'>) {
  const d = new Date(`${h.date}T${h.time || '00:00'}`);
  return Number.isNaN(d.getTime()) ? h.date : d.toISOString();
}

async function send(method: 'POST' | 'PUT', url: string, body: unknown): Promise<Result> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) return { ok: false, error: data?.error || 'Kaydedilemedi' };
  return { ok: true, id: data.id };
}

export function saveInvoice(method: 'POST' | 'PUT', url: string, h: DocHeader, items: unknown[], extra: Record<string, unknown> = {}) {
  return send(method, url, {
    customerId: h.partyId,
    invoiceNo: h.invoiceNo.trim() || undefined,
    date: headerDateIso(h),
    dueDate: h.dueDate || null,
    irsaliyeNo: h.irsaliyeNo,
    sevkTarihi: h.sevkTarihi || null,
    currency: h.currency,
    vatRate: parseFloat(h.vatRate) || 0,
    notes: h.notes,
    items,
    ...extra,
  });
}

export function savePurchase(method: 'POST' | 'PUT', url: string, h: DocHeader, items: unknown[] | undefined) {
  return send(method, url, {
    supplierId: h.partyId,
    invoiceNo: h.invoiceNo.trim() || undefined,
    date: headerDateIso(h),
    currency: h.currency,
    notes: h.notes,
    ...(items ? { items } : {}),
  });
}

// Kayıtlı tarihi ekrandaki tarih/saat alanlarına böler (tarayıcı saatine göre)
export function localDateParts(iso: string | Date | null | undefined) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
