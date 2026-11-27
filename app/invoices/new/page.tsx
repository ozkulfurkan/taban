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
    // Fiyat müşterinin para biriminde: özel fiyat → liste fiyatı (kurla çevrilmiş); bulunamazsa boş, elle girilir
    const priceOf = (productId?: string | null) => {
      const v = productId ? order?.prices?.[productId]?.unitPrice : undefined;
      return typeof v === 'number' && v > 0 ? toPriceInput(Math.round(v * 100) / 100) : '';
    };
    // Paket sipariş: her kalem kendi ürünü ve miktarıyla ayrı satır (renk açıklamaya eklenir)
    // Sevkiyat yapıldıysa fatura sevk edilen gerçek miktarlarla (ör. 500 kg sipariş → 490 kg sevk)
    const shipped: any[] | null = Array.isArray(order?.shipment?.items) ? order.shipment.items : null;
    const shippedQty = (index: number, fallback: number) => {
      const s = shipped?.find(x => x.index === index);
      return s ? Number(s.shipped) : fallback;
    };
    if (Array.isArray(order?.orderItems) && order.orderItems.length) {
      return (order.orderItems as any[]).map((item, index) => ({ item, qty: shippedQty(index, item.totalQuantity) })).filter(x => x.qty > 0).map(({ item, qty }) => {
        const p = item.productId ? products.find(x => x.id === item.productId) : undefined;
        const name = [item.productCode, item.productName || p?.name].filter(Boolean).join(' ') || 'Ürün';
        return emptyLine({
          itemType: p ? 'product' : 'free', productId: p?.id,
          description: item.color ? `${name} — ${item.color}` : name,
          quantity: String(qty),
          unitPrice: priceOf(p?.id),
        });
      });
    }
    if (order?.productId) {
      const p = products.find(x => x.id === order.productId);
      return [emptyLine({
        itemType: 'product', productId: order.productId,
        description: order.productCode || p?.name || '',
        quantity: String(shippedQty(0, order.totalQuantity) || 1),
        unitPrice: priceOf(order.productId),
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

  // Siparişten gelindiyse sipariş yüklenince açılır (irsaliye no ve sevk tarihi sevkiyattan gelir)
  if (orderId && !order) return <AppShell><div className="py-16 text-center text-ink-400 text-sm">Sipariş yükleniyor…</div></AppShell>;
  // Sevk fişiyle hesaba işlenmiş siparişten ikinci satış açılmasın
  if (order && (order.shipments ?? []).some((x: any) => x.invoiceId)) {
    return <AppShell><div className="max-w-xl mx-auto py-16 text-center space-y-2" data-testid="convert-blocked">
      <p className="font-semibold text-ink-800">Bu sipariş sevk fişiyle cari hesaba işlendi.</p>
      <p className="text-sm text-ink-500">Aynı malı ikinci kez borç yazmamak için sipariş ayrıca satışa çevrilemez. Fişi Sevkiyat ekranından görebilirsiniz.</p>
    </div></AppShell>;
  }
  const shipmentHeader = order?.shipment ? {
    irsaliyeNo: order.shipment.deliveryNoteNo ?? '',
    sevkTarihi: order.shipment.shipmentDate ? new Date(order.shipment.shipmentDate).toISOString().split('T')[0] : undefined,
  } : undefined;

  return (
    <AppShell>
      <DocumentEditor
        initialHeader={shipmentHeader ? Object.fromEntries(Object.entries(shipmentHeader).filter(([, v]) => v !== undefined)) as any : undefined}
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
