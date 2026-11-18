'use client';

import { useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import DocumentEditor, { type DocHeader } from '@/app/components/document-editor';
import { useLanguage } from '@/lib/i18n/language-context';
import { type DocLine, invoiceItemsPayload } from '@/lib/document-lines';
import { saveInvoice } from '@/lib/document-submit';

// Yeni iade: satışla aynı ekran, kırmızı vurgu; stok geri eklenir.
export default function ReturnInvoicePage() {
  const { t } = useLanguage();
  const customerId = useSearchParams()?.get('customerId') ?? '';

  const onSubmit = async (h: DocHeader, lines: DocLine[]) => {
    const r = await saveInvoice('POST', '/api/invoices', h, invoiceItemsPayload(lines), { isReturn: true });
    if (!r.ok) return r;
    return { ok: true as const, redirect: h.partyId ? `/customers/${h.partyId}` : `/invoices/${r.id}` };
  };

  return (
    <AppShell>
      <DocumentEditor
        kind="return" mode="new"
        title={t('newInvoice', 'returnTitle')}
        saveLabel={t('newInvoice', 'saveReturn')}
        lockedPartyId={customerId || undefined}
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}
