'use client';

import { useState } from 'react';
import { ShippedTable } from '@/app/components/shipment-qty';
import { FileText, Loader2, Truck } from '@/app/components/icons';
import { deliveryNoteHtml } from '@/lib/delivery-note-html';
import { printHtml } from '@/app/components/print-html';

type Shipment = { id: string; shipmentDate: string; deliveryNoteNo?: string | null; carrier?: string | null; trackingNo?: string | null; notes?: string | null; items?: any; totalQuantity?: number | null };

// Siparişin sevkiyatları (kısmi sevkiyat): her biri için bilgiler, kalemler ve irsaliye çıktısı.
// noteEndpoint: irsaliye verisi ucu (…/delivery-note); t: portal çevirisi (yoksa Türkçe)
// complete: sipariş "Sevk Edildi" mi; tek ve tamamlanmış sevkiyatta sipariş/fark tablosu, aksi halde kısmi görünüm
export function ShipmentList({ shipments, noteEndpoint, t = s => s, onEdit, complete = true }: {
  shipments: Shipment[]; noteEndpoint: string; t?: (s: string) => string; onEdit?: (s: Shipment) => void; complete?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!shipments?.length) return null;

  const print = async (s: Shipment) => {
    setBusy(s.id); setError('');
    try {
      const r = await fetch(`${noteEndpoint}?shipment=${encodeURIComponent(s.id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'İrsaliye hazırlanamadı');
      await printHtml(deliveryNoteHtml(d));
    } catch (e: any) { setError(e?.message || 'İrsaliye hazırlanamadı'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3" data-testid="shipment-list">
      {shipments.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-ink-200 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-ink-800 flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-emerald-600" />
              {shipments.length > 1 ? `${i + 1}. ${t('sevkiyat')}` : t('Sevkiyat')} · {new Date(s.shipmentDate).toLocaleDateString('tr-TR')}
            </p>
            <div className="flex items-center gap-2">
              {onEdit && <button onClick={() => onEdit(s)} className="text-xs font-medium text-ink-600 hover:text-ink-900">{t('Düzenle')}</button>}
              <button onClick={() => print(s)} disabled={busy === s.id} data-testid={`delivery-note-${i}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-ink-200 bg-white hover:bg-ink-50 text-xs font-medium text-ink-700">
                {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {t('İrsaliye')}
              </button>
            </div>
          </div>
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[[t('İrsaliye No'), s.deliveryNoteNo], [t('Taşıyıcı'), s.carrier], [t('Takip No'), s.trackingNo], [t('Not'), s.notes]].map(([k, v]) => (
              <div key={String(k)}><dt className="text-ink-400">{k}</dt><dd className="font-medium text-ink-700">{v || '—'}</dd></div>
            ))}
          </dl>
          {Array.isArray(s.items) && <div className="mt-3 pt-3 border-t border-ink-100"><ShippedTable items={s.items} partial={shipments.length > 1 || !complete} t={t} /></div>}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
