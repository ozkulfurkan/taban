'use client';
// Sevk fişini firmanın yazdırma ayarlarıyla (A4 / A5 / sürekli form / matbu) yazdırır.
import { dispatchPrintHtml, type DispatchPrintInput } from '@/lib/dispatch-print-html';
import { printHtml } from '@/app/components/print-html';

export async function printDispatch(id: string) {
  const r = await fetch(`/api/dispatches/${id}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Sevk fişi yüklenemedi');
  const input: DispatchPrintInput = {
    company: d.company, customer: d.customer, no: d.no, date: d.date,
    carrier: d.carrier, vehiclePlate: d.vehiclePlate, driverName: d.driverName, notes: d.notes,
    currency: d.currency, vatRate: d.vatRate,
    lines: (d.lines ?? []).map((l: any) => ({ code: l.code, name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice })),
  };
  // Fiyat yetkisi olmayan kullanıcıda fiyatlar zaten gelmez; ayar açık olsa da basılmaz
  const cfg = { ...(d.printSettings ?? {}), showPrices: !!d.printSettings?.showPrices && !!d.canPrice };
  await printHtml(dispatchPrintHtml(input, cfg));
  fetch(`/api/dispatches/${id}`, { method: 'PATCH' }).catch(() => {});
}
