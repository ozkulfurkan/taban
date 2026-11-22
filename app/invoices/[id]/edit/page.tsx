'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from '@/app/components/icons';
import AppShell from '@/app/components/app-shell';
import DocumentEditor, { type DocHeader } from '@/app/components/document-editor';
import { type DocLine, invoiceItemsPayload, lineFromInvoiceItem } from '@/lib/document-lines';
import { saveInvoice, localDateParts } from '@/lib/document-submit';

// Satış ve iade faturası düzenleme: yeni kayıtla aynı ekran.
export default function EditInvoicePage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [invoice, setInvoice] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/invoices/${id}`).then(r => r.json()).then(d => {
      if (d?.id) setInvoice(d); else setError(d?.error || 'Fatura bulunamadı');
    }).catch(() => setError('Fatura yüklenemedi'));
  }, [id]);

  if (!invoice) {
    return (
      <AppShell>
        {error ? <p className="text-center py-16 text-ink-500">{error}</p>
          : <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>}
      </AppShell>
    );
  }

  const isReturn = !!invoice.isReturn;
  const at = localDateParts(invoice.date);
  const header: Partial<DocHeader> = {
    partyId: invoice.customerId,
    invoiceNo: invoice.invoiceNo ?? '',
    date: at.date,
    time: at.time,
    dueDate: localDateParts(invoice.dueDate).date,
    irsaliyeNo: invoice.irsaliyeNo ?? '',
    sevkTarihi: localDateParts(invoice.sevkTarihi).date,
    currency: invoice.currency,
    vatRate: String(invoice.vatRate ?? 0),
    notes: invoice.notes ?? '',
  };

  const onSubmit = async (h: DocHeader, lines: DocLine[]) => {
    const r = await saveInvoice('PUT', `/api/invoices/${id}`, h, invoiceItemsPayload(lines));
    return r.ok ? { ok: true as const, redirect: `/invoices/${id}` } : r;
  };

  return (
    <AppShell>
      <DocumentEditor
        kind={isReturn ? 'return' : 'sale'} mode="edit"
        title={`${isReturn ? 'İadeyi Düzenle' : 'Satışı Düzenle'} — ${invoice.invoiceNo}`}
        saveLabel="Değişiklikleri Kaydet"
        initialHeader={header}
        initialLines={(invoice.items ?? []).map(lineFromInvoiceItem)}
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}
