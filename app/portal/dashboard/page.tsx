'use client';

import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, stageLabel } from '@/lib/order-status';
import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalShell from '../components/portal-shell';
import { Plus, List, Package, Truck, Loader2 } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';

const STATUS_LABELS = ORDER_STATUS_LABEL;
const STATUS_COLOR = ORDER_STATUS_COLOR;

export default function PortalDashboardPage() {
  const { tp } = usePortalText();
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<{ usd: number | null; eur: number | null; date: string | null }>({ usd: null, eur: null, date: null });

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/portal/me/orders')
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
    fetch('/api/exchange-rates')
      .then(r => r.json())
      .then(d => { if (!d.error) setRates(d); })
      .catch(() => {});
  }, [status, router]);

  const user = session?.user as any;
  const active = orders.filter(o => !['SHIPPED', 'CANCELLED'].includes(o.status)).length;
  const shipped = orders.filter(o => o.status === 'SHIPPED').length;

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>;

  return (
    <PortalShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{tp('Hoşgeldiniz')}, {user?.name} 👋</h1>
            <p className="text-ink-500 text-sm mt-0.5">{tp('Sipariş durumlarınızı buradan takip edebilirsiniz.')}</p>
          </div>
          <Link href="/portal/orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" /> {tp('Yeni Sipariş')}
          </Link>
        </div>

        {/* Exchange rates */}
        {(rates.usd || rates.eur) && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-ink-400 font-medium">TCMB{rates.date ? ` · ${new Date(rates.date).toLocaleDateString('tr-TR')}` : ''}:</span>
            {rates.usd && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-ink-100 text-sm font-semibold text-ink-700">
                <span className="text-emerald-500 text-xs font-bold">$</span> 1 USD = {rates.usd.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} TL
              </span>
            )}
            {rates.eur && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-ink-100 text-sm font-semibold text-ink-700">
                <span className="text-brand-600 text-xs font-bold">€</span> 1 EUR = {rates.eur.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} TL
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: tp('Toplam Sipariş'), value: orders.length, icon: List, color: 'blue' },
            { label: tp('Aktif Sipariş'), value: active, icon: Package, color: 'orange' },
            { label: tp('Teslim Edildi'), value: shipped, icon: Truck, color: 'green' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-card border border-ink-200/80">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${color}-100`}>
                <Icon className={`w-4 h-4 text-${color}-600`} />
              </div>
              <p className="text-2xl font-bold text-ink-800">{value}</p>
              <p className="text-xs text-ink-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <h2 className="font-semibold text-ink-700">{tp('Son Siparişler')}</h2>
            <Link href="/portal/orders" className="text-xs text-brand-700 hover:underline">{tp('Tümünü Gör')}</Link>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-ink-400 text-sm">{tp('Henüz sipariş yok')}</div>
          ) : (
            <div className="divide-y divide-ink-50">
              {orders.slice(0, 5).map(order => (
                <Link key={order.id} href={`/portal/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-ink-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-ink-800">{order.orderNo}</p>
                    <p className="text-xs text-ink-400">{order.productCode || order.product?.name || '—'} · {formatQty(order.totalQuantity, order.unit)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? 'bg-ink-100 text-ink-600'}`}>
                    {tp(order.status === 'ORDER_RECEIVED' ? stageLabel(order) : STATUS_LABELS[order.status] ?? order.status)}
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
