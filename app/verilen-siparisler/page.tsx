'use client';

import { formatQty } from '@/lib/order-units';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Loader2 } from '@/app/components/icons';
import AppShell from '@/app/components/app-shell';
import { ORDER_STATUS_COLOR, stageLabel } from '@/lib/order-status';

type Order = {
  id: string; orderNo: string; status: string; createdAt: string; totalQuantity: number; unit: string | null;
  requestedDeliveryDate: string | null; confirmedDeliveryDate: string | null; linkId: string | null;
  orderItems: { productCode?: string; productName?: string }[] | null; productCode: string | null;
  link: { sellerCompany: { name: string } } | null;
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');

// Bağlı SoleCost tedarikçilerine verilen siparişler ve durumları
export default function NetworkOrdersPage() {
  const linkId = useSearchParams()?.get('linkId');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<'active' | 'shipped' | 'cancelled' | 'all'>('active');

  useEffect(() => {
    fetch(`/api/network/orders${linkId ? `?linkId=${linkId}` : ''}`).then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : [])).catch(() => setOrders([]));
  }, [linkId]);

  const rows = useMemo(() => (orders ?? []).filter(o =>
    filter === 'all' ? true : filter === 'shipped' ? o.status === 'SHIPPED' : filter === 'cancelled' ? o.status === 'CANCELLED' : !['SHIPPED', 'CANCELLED'].includes(o.status)), [orders, filter]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Verilen Siparişler</h1>
            <p className="text-ink-500 text-sm mt-0.5">SoleCost&apos;ta bağlı olduğunuz tedarikçilere verdiğiniz hammadde siparişleri.</p>
          </div>
          <Link href="/verilen-siparisler/yeni" data-testid="material-order-new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold">+ Yeni hammadde siparişi</Link>
        </div>
        <div className="flex gap-1 bg-ink-100 rounded-lg p-1 w-fit">
          {([['active', 'Aktif'], ['shipped', 'Sevk edilen'], ['cancelled', 'İptal'], ['all', 'Tümü']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${filter === v ? 'bg-white shadow-sm text-ink-800' : 'text-ink-500'}`}>{l}</button>
          ))}
        </div>
        {orders === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-card border border-ink-200/80">
            <ClipboardList className="w-10 h-10 text-ink-200 mx-auto mb-3" />
            <p className="text-ink-400 text-sm">Sipariş yok.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-x-auto border border-ink-200/80">
            <table className="w-full text-sm">
              <thead className="bg-ink-50">
                <tr>{['Sipariş', 'Tedarikçi', 'Model', 'Adet', 'Termin', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map(o => {
                  const items = Array.isArray(o.orderItems) ? o.orderItems : [];
                  return (
                    <tr key={o.id} className="hover:bg-ink-50" data-testid={`network-order-${o.id}`}>
                      <td className="px-4 py-3">
                        <Link href={`/verilen-siparisler/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.orderNo}</Link>
                        {(o as any).unreadMessages > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-brand-700 text-white text-[10px] font-semibold" data-testid={`network-unread-${o.id}`}>{(o as any).unreadMessages} yeni mesaj</span>
                        )}
                        <p className="text-xs text-ink-400">{fmt(o.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{o.link?.sellerCompany.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{items.length > 1 ? `${items.length} model` : (items[0]?.productCode || items[0]?.productName || o.productCode || '—')}</td>
                      <td className="px-4 py-3 font-semibold text-ink-800">{formatQty(o.totalQuantity, o.unit)}</td>
                      <td className="px-4 py-3 text-ink-600">{fmt(o.confirmedDeliveryDate ?? o.requestedDeliveryDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLOR[o.status] ?? 'bg-ink-100 text-ink-600'}`}>{stageLabel(o)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
