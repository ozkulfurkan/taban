'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ChevronRight, ArrowUpDown } from '@/app/components/icons';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretime Başlandı', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-brand-100 text-brand-800',
  IN_PRODUCTION: 'bg-brand-100 text-brand-800', IN_PROGRESS: 'bg-brand-100 text-brand-800',
  COMPLETED: 'bg-emerald-100 text-emerald-700', RECEIVED: 'bg-brand-100 text-brand-800',
  CANCELLED: 'bg-ink-100 text-ink-500',
};

type SortKey = 'dueDate' | 'createdAt';

export default function FasonOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [sort, setSort] = useState<SortKey>('dueDate');

  useEffect(() => {
    fetch('/api/portal/fason/orders')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    if (filter === 'active') return !['COMPLETED', 'RECEIVED', 'CANCELLED'].includes(o.status);
    if (filter === 'done') return ['COMPLETED', 'RECEIVED', 'CANCELLED'].includes(o.status);
    return true;
  });

  const displayed = [...filtered].sort((a, b) => {
    if (sort === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Siparişlerim</h1>
        <p className="text-ink-500 text-sm mt-0.5">Size atanan tüm fason siparişleri</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-card p-1 border border-ink-200/80">
          {[
            { key: 'active', label: 'Aktif' },
            { key: 'done', label: 'Tamamlanan' },
            { key: 'all', label: 'Tümü' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-amber-100 text-amber-700' : 'text-ink-600 hover:text-ink-900'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 bg-white rounded-xl shadow-card px-3 py-1.5 border border-ink-200/80">
          <ArrowUpDown className="w-3.5 h-3.5 text-ink-400" />
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
            className="text-sm text-ink-600 outline-none bg-transparent cursor-pointer">
            <option value="dueDate">Termina Göre</option>
            <option value="createdAt">Sipariş Tarihine Göre</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center text-ink-400 text-sm border border-ink-200/80">
          Bu kategoride sipariş bulunamadı.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden divide-y divide-ink-100 border border-ink-200/80">
          {displayed.map((o: any) => {
            const isOverdue = o.dueDate && new Date(o.dueDate) < new Date() && !['COMPLETED', 'RECEIVED', 'CANCELLED'].includes(o.status);
            return (
              <Link key={o.id} href={`/portal/fason/orders/${o.id}`}
                className="flex items-center justify-between px-4 py-4 hover:bg-ink-50 group">
                <div>
                  <p className="font-semibold text-ink-800 text-sm">{o.orderNo}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{o.product?.name || '—'} · {o.totalPairs} çift</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                    {o.dueDate && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-ink-400'}`}>
                        {isOverdue ? 'Gecikti — ' : ''}{new Date(o.dueDate).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
