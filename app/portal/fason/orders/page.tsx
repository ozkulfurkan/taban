'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ChevronRight } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretime Başlandı', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700', IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700', RECEIVED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function FasonOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    fetch('/api/portal/fason/orders')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .finally(() => setLoading(false));
  }, []);

  const displayed = orders.filter(o => {
    if (filter === 'active') return !['RECEIVED', 'CANCELLED'].includes(o.status);
    if (filter === 'done') return ['RECEIVED', 'CANCELLED'].includes(o.status);
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Siparişlerim</h1>
        <p className="text-slate-500 text-sm mt-0.5">Size atanan tüm fason siparişleri</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-white rounded-xl shadow-sm p-1 w-fit">
        {[
          { key: 'active', label: 'Aktif' },
          { key: 'done', label: 'Tamamlanan' },
          { key: 'all', label: 'Tümü' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-orange-500" /></div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate-400 text-sm">
          Bu kategoride sipariş bulunamadı.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
          {displayed.map((o: any) => {
            const isOverdue = o.dueDate && new Date(o.dueDate) < new Date() && !['RECEIVED', 'CANCELLED'].includes(o.status);
            return (
              <Link key={o.id} href={`/portal/fason/orders/${o.id}`}
                className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 group">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{o.orderNo}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{o.product?.name || '—'} · {o.totalPairs} çift</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                    {o.dueDate && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                        {isOverdue ? 'Gecikti — ' : ''}{new Date(o.dueDate).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
