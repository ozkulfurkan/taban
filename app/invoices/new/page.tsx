'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import DocumentEditor, { type DocHeader } from '@/app/components/document-editor';
import { useLanguage } from '@/lib/i18n/language-context';
import { toPriceInput } from '@/lib/price-input';
import { type DocLine, emptyLine, invoiceItemsPayload } from '@/lib/document-lines';
import { saveInvoice } from '@/lib/document-submit';

// Yeni satış: ortak belge ekranı. Sipariş ya da portal "Satışa Çevir" ile
// gelindiğinde kalem otomatik doldurulur.
export default function NewInvoicePage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const customerId = searchParams?.get('customerId') ?? '';
  const prefillProductId = searchParams?.get('productId') ?? '';
  const prefillQuantity = searchParams?.get('quantity') ?? '';
  const orderId = searchParams?.get('orderId') ?? '';
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}`).then(r => r.json()).then(o => { if (o?.id) setOrder(o); }).catch(() => {});
  }, [orderId]);

  const prefillLines = useCallback((products: any[]): DocLine[] => {
    if (order?.productId) {
      const p = products.find(x => x.id === order.productId);
      return [emptyLine({
        itemType: 'product', productId: order.productId,
        description: order.productCode || p?.name || '',
        quantity: String(order.totalQuantity || 1),
        unitPrice: p ? toPriceInput(p.unitPrice) : '',
        partVariantsData: Array.isArray(order.partVariantsData) && order.partVariantsData.length ? order.partVariantsData : undefined,
      })];
    }
    if (prefillProductId) {
      const p = products.find(x => x.id === prefillProductId);
      if (p) return [emptyLine({ itemType: 'product', productId: p.id, description: p.name, quantity: prefillQuantity || '1', unitPrice: toPriceInput(p.unitPrice) })];
    }
    return [];
  }, [order, prefillProductId, prefillQuantity]);

  const onSubmit = async (h: DocHeader, lines: DocLine[]) => {
    const r = await saveInvoice('POST', '/api/invoices', h, invoiceItemsPayload(lines), { isReturn: false });
    if (!r.ok) return r;
    if (orderId) {
      await fetch(`/api/orders/${orderId}/mark-converted`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: r.id }),
      }).catch(() => {});
    }
    return { ok: true as const, redirect: h.partyId ? `/customers/${h.partyId}` : `/invoices/${r.id}` };
  };

  return (
    <AppShell>
      <DocumentEditor
        kind="sale" mode="new"
        title={t('newInvoice', 'title')}
        saveLabel={t('newInvoice', 'save')}
        lockedPartyId={customerId || undefined}
        prefillLines={orderId || prefillProductId ? prefillLines : undefined}
        infoRows={order?.orderNo ? [{ label: 'Sipariş No', value: order.orderNo }] : []}
        confirmStock
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}
