'use client';

import { formatQty } from '@/lib/order-units';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Loader2 } from 'lucide-react';
import AppShell from '@/app/components/app-shell';
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '@/lib/order-status';

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
  const [filter, setFilter] = useState<'active' | 'shipped' | 'all'>('active');

  useEffect(() => {
    fetch(`/api/network/orders${linkId ? `?linkId=${linkId}` : ''}`).then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : [])).catch(() => setOrders([]));
  }, [linkId]);

  const rows = useMemo(() => (orders ?? []).filter(o =>
    filter === 'all' ? true : filter === 'shipped' ? o.status === 'SHIPPED' : o.status !== 'SHIPPED'), [orders, filter]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Verilen Siparişler</h1>
          <p className="text-slate-500 text-sm mt-0.5">SoleCost&apos;ta bağlı olduğunuz tedarikçilere verdiğiniz siparişler. Yeni sipariş için tedarikçi sayfasındaki <b>Sipariş ver</b> düğmesini kullanın.</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {([['active', 'Aktif'], ['shipped', 'Sevk edilen'], ['all', 'Tümü']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${filter === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        {orders === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sipariş yok.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{['Sipariş', 'Tedarikçi', 'Model', 'Adet', 'Termin', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(o => {
                  const items = Array.isArray(o.orderItems) ? o.orderItems : [];
                  return (
                    <tr key={o.id} className="hover:bg-slate-50" data-testid={`network-order-${o.id}`}>
                      <td className="px-4 py-3">
                        <Link href={`/verilen-siparisler/${o.id}`} className="font-semibold text-blue-600 hover:underline">{o.orderNo}</Link>
                        <p className="text-xs text-slate-400">{fmt(o.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{o.link?.sellerCompany.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{items.length > 1 ? `${items.length} model` : (items[0]?.productCode || items[0]?.productName || o.productCode || '—')}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{formatQty(o.totalQuantity, o.unit)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmt(o.confirmedDeliveryDate ?? o.requestedDeliveryDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLOR[o.status] ?? 'bg-slate-100 text-slate-600'}`}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
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
