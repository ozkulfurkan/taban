'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Plus, Loader2, AlertTriangle, Factory, ArrowUpDown } from '@/app/components/icons';

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

const DONE_STATUSES = ['COMPLETED', 'RECEIVED', 'CANCELLED'];

export default function SubcontractorOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [filterSub, setFilterSub] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'done' | 'all'>('active');
  const [sort, setSort] = useState<'dueDate' | 'createdAt'>('dueDate');

  const load = () => {
    const params = new URLSearchParams();
    if (filterSub) params.set('subcontractorId', filterSub);
    setLoading(true);
    fetch(`/api/subcontractor-orders?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setOrders(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/subcontractors').then(r => r.json()).then(d => { if (Array.isArray(d)) setSubcontractors(d); });
  }, []);

  useEffect(() => { load(); }, [filterSub]);

  const filtered = orders.filter(o => {
    if (filterTab === 'active') return !DONE_STATUSES.includes(o.status);
    if (filterTab === 'done') return DONE_STATUSES.includes(o.status);
    return true;
  });

  const isOverdue = (o: any) => o.dueDate && new Date(o.dueDate) < new Date() && !['RECEIVED', 'CANCELLED'].includes(o.status);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-600" />
            <h1 className="page-title">Fason Siparişler</h1>
          </div>
          <Link href="/subcontractor-orders/new" className="flex items-center gap-2 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Yeni Sipariş
          </Link>
        </div>

        {/* Tabs + Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Tabs */}
          <div className="flex gap-1 bg-white rounded-xl shadow-card p-1 border border-ink-100">
            {([
              { key: 'active', label: 'Aktif' },
              { key: 'done', label: 'Tamamlanan' },
              { key: 'all', label: 'Tümü' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setFilterTab(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterTab === key ? 'bg-amber-100 text-amber-700' : 'text-ink-600 hover:text-ink-900'}`}>
                {label}
              </button>
            ))}
          </div>

          <select value={filterSub} onChange={e => setFilterSub(e.target.value)}
            className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Tüm Fasoncular</option>
            {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-ink-200 rounded-lg bg-white">
            <ArrowUpDown className="w-3.5 h-3.5 text-ink-400" />
            <select value={sort} onChange={e => setSort(e.target.value as 'dueDate' | 'createdAt')}
              className="text-sm text-ink-600 outline-none bg-transparent cursor-pointer">
              <option value="dueDate">Termina Göre</option>
              <option value="createdAt">Sipariş Tarihine Göre</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-400">Bu kategoride sipariş bulunamadı</div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 border-b text-xs font-semibold text-ink-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Sipariş No</th>
                <th className="px-4 py-3 text-left">Fasoncu</th>
                <th className="px-4 py-3 text-left">Ürün</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-right">Termin</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {[...filtered].sort((a, b) => {
                  if (sort === 'dueDate') {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  }
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }).map((o: any) => (
                  <tr key={o.id} className={`hover:bg-ink-50/60 ${isOverdue(o) ? 'bg-red-50/20' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/subcontractor-orders/${o.id}`} className="text-brand-700 hover:underline font-medium flex items-center gap-1">
                        {isOverdue(o) && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{o.subcontractor?.name}</td>
                    <td className="px-4 py-3 text-ink-600">{o.product?.name || <span className="text-ink-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-700">{o.totalPairs}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${isOverdue(o) ? 'text-red-600' : 'text-ink-500'}`}>
                      {o.dueDate ? new Date(o.dueDate).toLocaleDateString('tr-TR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
