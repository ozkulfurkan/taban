'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Factory, AlertTriangle, Package, Clock } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretimde', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700', IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700', RECEIVED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
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

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  const activeOrders = orders.filter(o => !['RECEIVED', 'CANCELLED'].includes(o.status));
  const overdue = activeOrders.filter(o => o.dueDate && new Date(o.dueDate) < new Date());
  const upcoming = activeOrders.filter(o => {
    if (!o.dueDate) return false;
    const diff = (new Date(o.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });
  const totalStock = stocks.reduce((s, st) => s + (st.quantity || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Ana Sayfa</h1>
        <p className="text-slate-500 text-sm mt-0.5">Fason portalınıza hoş geldiniz</p>
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
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Factory className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Aktif Sipariş</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{activeOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">7 Günde Bitenler</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{upcoming.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Toplam Hammadde</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalStock.toFixed(1)} <span className="text-base font-normal text-slate-400">kg</span></p>
        </div>
      </div>

      {/* Son siparişler */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="font-semibold text-slate-700 text-sm">Son Siparişler</p>
          <Link href="/portal/fason/orders" className="text-orange-600 hover:underline text-xs font-medium">Tümünü gör</Link>
        </div>
        {orders.slice(0, 5).length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">Henüz sipariş yok</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.slice(0, 5).map((o: any) => (
              <Link key={o.id} href={`/portal/fason/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-700 text-sm">{o.orderNo}</p>
                  <p className="text-xs text-slate-400">{o.product?.name || '—'} · {o.totalPairs} çift</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  {o.dueDate && <p className="text-xs text-slate-400 mt-0.5">{new Date(o.dueDate).toLocaleDateString('tr-TR')}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
