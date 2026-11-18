'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AppShell from '@/app/components/app-shell';
import DocumentEditor, { type DocHeader } from '@/app/components/document-editor';
import { type DocLine, purchaseItemsPayload, lineFromPurchaseMaterial } from '@/lib/document-lines';
import { savePurchase, localDateParts } from '@/lib/document-submit';

// Alış düzenleme: yeni alışla aynı ekran. Kalemler değişirse stok farkı otomatik düzeltilir.
export default function EditPurchasePage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [purchase, setPurchase] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/purchases/${id}`).then(r => r.json()).then(d => {
      if (d?.id) setPurchase(d); else setError(d?.error || 'Alış bulunamadı');
    }).catch(() => setError('Alış yüklenemedi'));
  }, [id]);

  if (!purchase) {
    return (
      <AppShell>
        {error ? <p className="text-center py-16 text-slate-500">{error}</p>
          : <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}
      </AppShell>
    );
  }

  const pms: any[] = purchase.purchaseMaterials ?? [];
  const legacy = pms.length === 0; // kalemsiz eski alış: sadece başlık düzenlenebilir ya da kalem eklenebilir
  const at = localDateParts(purchase.date);
  const header: Partial<DocHeader> = {
    partyId: purchase.supplierId,
    invoiceNo: purchase.invoiceNo ?? '',
    date: at.date,
    time: at.time,
    currency: purchase.currency,
    notes: purchase.notes ?? '',
    subcontractorId: pms.find(p => p.subcontractorId)?.subcontractorId ?? '',
  };

  const onSubmit = async (h: DocHeader, lines: DocLine[]) => {
    const items = legacy && lines.length === 0 ? undefined : purchaseItemsPayload(lines, h.subcontractorId);
    const r = await savePurchase('PUT', `/api/purchases/${id}`, h, items);
    return r.ok ? { ok: true as const, redirect: `/purchases/${id}` } : r;
  };

  return (
    <AppShell>
      <DocumentEditor
        kind={purchase.isReturn ? 'purchaseReturn' : 'purchase'} mode="edit"
        title={`${purchase.isReturn ? 'İadeyi Düzenle' : 'Alışı Düzenle'} — ${purchase.invoiceNo ?? ''}`}
        saveLabel="Değişiklikleri Kaydet"
        initialHeader={header}
        initialLines={pms.map(lineFromPurchaseMaterial)}
        minLines={legacy ? 0 : 1}
        notice={legacy ? 'Bu alışın kalem bilgisi yok. Kalem eklerseniz toplam kalemlerden yeniden hesaplanır.' : undefined}
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}
