'use client';

import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, stageLabel } from '@/lib/order-status';
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

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

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
          {['', ...Object.keys(STATUS_LABELS)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-brand-700 text-white' : 'bg-white text-ink-600 hover:bg-ink-100 border border-ink-200'
              }`}>
              {s ? tp(STATUS_LABELS[s]) : tp('Tümü')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-ink-400 text-sm">{tp('Sipariş bulunamadı')}</div>
          ) : (
            <div className="overflow-x-auto">
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
                          {tp(order.status === 'ORDER_RECEIVED' ? stageLabel(order) : STATUS_LABELS[order.status] ?? order.status)}
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
          )}
        </div>
      </div>
    </PortalShell>
  );
}
