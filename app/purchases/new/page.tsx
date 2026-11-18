'use client';

import { useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import DocumentEditor, { type DocHeader } from '@/app/components/document-editor';
import { type DocLine, purchaseItemsPayload } from '@/lib/document-lines';
import { savePurchase } from '@/lib/document-submit';

// Yeni alış: satışla aynı ekran; kalem hammadde ya da ürün olabilir.
export default function NewPurchasePage() {
  const supplierId = useSearchParams()?.get('supplierId') ?? '';

  const onSubmit = async (h: DocHeader, lines: DocLine[]) => {
    const r = await savePurchase('POST', '/api/purchases', h, purchaseItemsPayload(lines, h.subcontractorId));
    if (!r.ok) return r;
    return { ok: true as const, redirect: `/suppliers/${h.partyId}` };
  };

  return (
    <AppShell>
      <DocumentEditor
        kind="purchase" mode="new"
        title="Yeni Alış"
        saveLabel="Alışı Kaydet"
        lockedPartyId={supplierId || undefined}
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}
