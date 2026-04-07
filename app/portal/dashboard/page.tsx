'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalShell from '../components/portal-shell';
import { Plus, List, Package, Truck, Loader2 } from 'lucide-react';

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

export default function PortalDashboardPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/portal/me/orders')
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status, router]);

  const user = session?.user as any;
  const active = orders.filter(o => o.status !== 'SHIPPED').length;
  const shipped = orders.filter(o => o.status === 'SHIPPED').length;

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <PortalShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Hoşgeldiniz, {user?.name} 👋</h1>
            <p className="text-slate-500 text-sm mt-0.5">Sipariş durumlarınızı buradan takip edebilirsiniz.</p>
          </div>
          <Link href="/portal/orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" /> Yeni Sipariş
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Toplam Sipariş', value: orders.length, icon: List, color: 'blue' },
            { label: 'Aktif Sipariş', value: active, icon: Package, color: 'orange' },
            { label: 'Teslim Edildi', value: shipped, icon: Truck, color: 'green' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${color}-100`}>
                <Icon className={`w-4 h-4 text-${color}-600`} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Son Siparişler</h2>
            <Link href="/portal/orders" className="text-xs text-blue-600 hover:underline">Tümünü Gör</Link>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">Henüz sipariş yok</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {orders.slice(0, 5).map(order => (
                <Link key={order.id} href={`/portal/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{order.orderNo}</p>
                    <p className="text-xs text-slate-400">{order.productCode || order.product?.name || '—'} · {order.totalQuantity} adet</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
