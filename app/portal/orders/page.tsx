'use client';

import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, PRODUCTION_STATUSES, stageLabel } from '@/lib/order-status';
import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalShell from '../components/portal-shell';
import { Plus, Loader2, RefreshCw } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';

const STATUS_LABELS = ORDER_STATUS_LABEL;
const STATUS_COLOR = ORDER_STATUS_COLOR;
// Filtre 4 ana gruba iner
const GROUPS: Array<[string, string, (s: string) => boolean]> = [
  ['', 'Tümü', () => true],
  ['pending', 'Bekleyen', s => s === 'ORDER_RECEIVED'],
  ['production', 'Üretimde', s => PRODUCTION_STATUSES.includes(s) || s === 'READY_FOR_SHIPMENT'],
  ['shipped', 'Sevk edilen', s => s === 'SHIPPED'],
  ['cancelled', 'İptal', s => s === 'CANCELLED'],
];

export default function PortalOrdersPage() {
  const { tp } = usePortalText();
  const { status } = useSession() || {};
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/portal/me/orders')
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status, router]);

  const group = GROUPS.find(g => g[0] === filterStatus) ?? GROUPS[0];
  const filtered = orders.filter(o => group[2](o.status));
  const statusText = (order: any) => tp(order.status === 'ORDER_RECEIVED' ? stageLabel(order) : STATUS_LABELS[order.status] ?? order.status);
  const sourceText = (order: any) => (order.source === 'portal' ? tp('Portaldan') : order.source === 'network' ? tp('Firma ağından') : tp('Firma tarafından'));

  const handleRepeat = (order: any) => {
    const params = new URLSearchParams({
      productId: order.productId || '',
      productCode: order.productCode || '',
      color: order.color || '',
      material: order.material || '',
      sizeDistribution: JSON.stringify(order.sizeDistribution || {}),
    });
    router.push(`/portal/orders/new?${params.toString()}`);
  };

  return (
    <PortalShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">{tp('Siparişlerim')}</h1>
          <Link href="/portal/orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" /> {tp('Yeni Sipariş')}
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {GROUPS.map(([key, label]) => (
            <button key={key} onClick={() => setFilterStatus(key)} data-testid={`orders-filter-${key || 'all'}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === key ? 'bg-brand-700 text-white' : 'bg-white text-ink-600 hover:bg-ink-100 border border-ink-200'
              }`}>
              {tp(label)}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-ink-400 text-sm">{tp('Sipariş bulunamadı')}</div>
          ) : (
            <>
            {/* Telefonda kart listesi */}
            <ul className="sm:hidden divide-y divide-ink-100" data-testid="orders-cards">
              {filtered.map(order => (
                <li key={order.id}>
                  <Link href={`/portal/orders/${order.id}`} className="block px-4 py-3 active:bg-ink-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-800">{order.orderNo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[order.status] ?? 'bg-ink-100 text-ink-600'}`}>{statusText(order)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                      <span className="truncate">
                        {Array.isArray(order.orderItems) && order.orderItems.length > 0 ? `${order.orderItems.length} ${tp('ürün')}` : order.productCode || order.product?.name || '—'}
                        {order.color ? ` · ${order.color}` : ''} · {formatQty(order.totalQuantity, order.unit)}
                      </span>
                      <span className="whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-400">
                      <span>{sourceText(order)}</span>
                      {order.unreadMessages > 0 && <span className="px-1.5 py-0.5 rounded-full bg-brand-700 text-white font-semibold">{order.unreadMessages} {tp('yeni mesaj')}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 border-b border-ink-200">
                  <tr>
                    {[tp('Sipariş No'), 'Model', tp('Renk'), tp('Adet'), tp('Termin'), tp('Durum'), ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {filtered.map(order => (
                    <tr key={order.id} className="hover:bg-ink-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink-800">
                        <Link href={`/portal/orders/${order.id}`} className="hover:text-brand-700">{order.orderNo}</Link>
                        <span className="block text-[11px] font-normal text-ink-400">{sourceText(order)}</span>
                        {order.unreadMessages > 0 && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-brand-700 text-white text-[10px] font-semibold">{order.unreadMessages} {tp('yeni mesaj')}</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {Array.isArray(order.orderItems) && order.orderItems.length > 0
                          ? <span className="text-xs font-semibold text-brand-800 bg-brand-50 px-1.5 py-0.5 rounded">
                              {order.orderItems.length} {tp('ürün')}
                            </span>
                          : order.productCode || order.product?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{order.color || '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{formatQty(order.totalQuantity, order.unit)}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs">
                        {order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString('tr-TR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-ink-100 text-ink-600'}`}>
                          {statusText(order)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!(Array.isArray(order.orderItems) && order.orderItems.length > 0) && (
                          <button onClick={() => handleRepeat(order)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-ink-100 hover:bg-ink-200 text-ink-600 rounded-lg text-xs font-medium transition-colors">
                            <RefreshCw className="w-3 h-3" /> {tp('Tekrarla')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
