'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalShell from '../components/portal-shell';
import { Plus, Loader2, RefreshCw } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Sipariş Alındı', IN_PRODUCTION: 'Üretimde', MOLDING: 'Kalıplama',
  PAINTING: 'Boya/Apre', PACKAGING: 'Paketleme', READY_FOR_SHIPMENT: 'Sevkiyata Hazır', SHIPPED: 'Sevk Edildi',
};
const STATUS_COLOR: Record<string, string> = {
  ORDER_RECEIVED: 'bg-blue-100 text-blue-700', IN_PRODUCTION: 'bg-orange-100 text-orange-700',
  MOLDING: 'bg-purple-100 text-purple-700', PAINTING: 'bg-pink-100 text-pink-700',
  PACKAGING: 'bg-yellow-100 text-yellow-700', READY_FOR_SHIPMENT: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700',
};

export default function PortalOrdersPage() {
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
          <h1 className="text-xl font-bold text-slate-800">Siparişlerim</h1>
          <Link href="/portal/orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" /> Yeni Sipariş
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['', ...Object.keys(STATUS_LABELS)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}>
              {s ? STATUS_LABELS[s] : 'Tümü'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">Sipariş bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Sipariş No', 'Model', 'Renk', 'Adet', 'Termin', 'Durum', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <Link href={`/portal/orders/${order.id}`} className="hover:text-blue-600">{order.orderNo}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{order.productCode || order.product?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{order.color || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{order.totalQuantity}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString('tr-TR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleRepeat(order)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                          <RefreshCw className="w-3 h-3" /> Tekrarla
                        </button>
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
