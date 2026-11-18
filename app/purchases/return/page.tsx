'use client';

import { useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import DocumentEditor, { type DocHeader } from '@/app/components/document-editor';
import { type DocLine, purchaseItemsPayload } from '@/lib/document-lines';
import { savePurchase } from '@/lib/document-submit';

// Tedarikçiye mal iadesi: alışla aynı ekran, turuncu vurgu. Stok düşer, tedarikçiye borç azalır.
export default function PurchaseReturnPage() {
  const supplierId = useSearchParams()?.get('supplierId') ?? '';

  const onSubmit = async (h: DocHeader, lines: DocLine[]) => {
    const r = await savePurchase('POST', '/api/purchases', h, purchaseItemsPayload(lines, h.subcontractorId), { isReturn: true });
    if (!r.ok) return r;
    return { ok: true as const, redirect: `/suppliers/${h.partyId}` };
  };

  return (
    <AppShell>
      <DocumentEditor
        kind="purchaseReturn" mode="new"
        title="Tedarikçiye İade"
        saveLabel="İadeyi Kaydet"
        lockedPartyId={supplierId || undefined}
        notice="İade edilen hammadde ve ürünler stoktan düşer; tedarikçiye olan borcunuz iade tutarı kadar azalır."
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}
