'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Factory, AlertTriangle, Package, Clock } from '@/app/components/icons';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretimde', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-brand-100 text-brand-800',
  IN_PRODUCTION: 'bg-brand-100 text-brand-800', IN_PROGRESS: 'bg-brand-100 text-brand-800',
  COMPLETED: 'bg-emerald-100 text-emerald-700', RECEIVED: 'bg-brand-100 text-brand-800',
  CANCELLED: 'bg-ink-100 text-ink-500',
};

export default function FasonDashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/fason/orders').then(r => r.json()),
      fetch('/api/portal/fason/stock').then(r => r.json()),
    ]).then(([o, s]) => {
      if (Array.isArray(o)) setOrders(o);
      if (Array.isArray(s)) setStocks(s);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>;

  const activeOrders = orders.filter(o => !['COMPLETED', 'RECEIVED', 'CANCELLED'].includes(o.status));
  const overdue = activeOrders.filter(o => o.dueDate && new Date(o.dueDate) < new Date());
  const upcoming = activeOrders.filter(o => {
    if (!o.dueDate) return false;
    const diff = (new Date(o.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Ana Sayfa</h1>
        <p className="text-ink-500 text-sm mt-0.5">Fason portalınıza hoş geldiniz</p>
      </div>

      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Geciken Sipariş!</p>
            <p className="text-red-600 text-sm">{overdue.length} siparişinizin termini geçmiş. Lütfen güncelleyin.</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-card p-5 border border-ink-200/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
              <Factory className="w-4 h-4 text-brand-700" />
            </div>
            <span className="text-sm font-medium text-ink-600">Aktif Sipariş</span>
          </div>
          <p className="text-3xl font-bold text-ink-800">{activeOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-5 border border-ink-200/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-brand-700" />
            </div>
            <span className="text-sm font-medium text-ink-600">7 Günde Bitenler</span>
          </div>
          <p className="text-3xl font-bold text-ink-800">{upcoming.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-5 border border-ink-200/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-brand-700" />
            </div>
            <span className="text-sm font-medium text-ink-600">Zimmetimdeki hammadde</span>
          </div>
          {/* Farklı hammaddeler toplanmaz; her biri ayrı gösterilir */}
          {stocks.filter(st => st.quantity > 0).length === 0 ? (
            <p className="text-sm text-ink-400">Zimmetinizde hammadde yok</p>
          ) : (
            <ul className="space-y-1">
              {stocks.filter(st => st.quantity > 0).slice(0, 3).map(st => (
                <li key={st.id} className="flex justify-between gap-2 text-sm">
                  <span className="text-ink-600 truncate">{st.material?.name}</span>
                  <span className="font-semibold text-ink-900 tabular-nums">{st.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} kg</span>
                </li>
              ))}
              {stocks.filter(st => st.quantity > 0).length > 3 && (
                <li><Link href="/portal/fason/stock" className="text-xs text-brand-700 hover:underline">Tümü ({stocks.filter(st => st.quantity > 0).length})</Link></li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Son siparişler */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="font-semibold text-ink-700 text-sm">Son Siparişler</p>
          <Link href="/portal/fason/orders" className="text-brand-700 hover:underline text-xs font-medium">Tümünü gör</Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-center py-8 text-ink-400 text-sm">Henüz sipariş yok</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {[...orders].sort((a, b) => {
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }).slice(0, 5).map((o: any) => (
              <Link key={o.id} href={`/portal/fason/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink-50">
                <div>
                  <p className="font-medium text-ink-700 text-sm">{o.orderNo}</p>
                  <p className="text-xs text-ink-400">{o.product?.name || '—'} · {o.totalPairs.toLocaleString('tr-TR')} çift</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  {o.dueDate && <p className="text-xs text-ink-400 mt-0.5">{new Date(o.dueDate).toLocaleDateString('tr-TR')}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
