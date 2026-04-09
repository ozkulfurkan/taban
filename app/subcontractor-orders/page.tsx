'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Plus, Loader2, AlertTriangle, Factory } from 'lucide-react';

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

export default function SubcontractorOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [filterSub, setFilterSub] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filterSub) params.set('subcontractorId', filterSub);
    if (filterStatus) params.set('status', filterStatus);
    setLoading(true);
    fetch(`/api/subcontractor-orders?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setOrders(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/subcontractors').then(r => r.json()).then(d => { if (Array.isArray(d)) setSubcontractors(d); });
  }, []);

  useEffect(() => { load(); }, [filterSub, filterStatus]);

  const isOverdue = (o: any) => o.dueDate && new Date(o.dueDate) < new Date() && !['RECEIVED', 'CANCELLED'].includes(o.status);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-orange-600" />
            <h1 className="text-lg font-bold text-slate-800">Fason Siparişler</h1>
          </div>
          <Link href="/subcontractor-orders/new" className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Yeni Sipariş
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select value={filterSub} onChange={e => setFilterSub(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Tüm Fasoncular</option>
            {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Tüm Durumlar</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-slate-400">Sipariş bulunamadı</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Sipariş No</th>
                <th className="px-4 py-3 text-left">Fasoncu</th>
                <th className="px-4 py-3 text-left">Ürün</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-right">Termin</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o: any) => (
                  <tr key={o.id} className={`hover:bg-slate-50/60 ${isOverdue(o) ? 'bg-red-50/20' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/subcontractor-orders/${o.id}`} className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                        {isOverdue(o) && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.subcontractor?.name}</td>
                    <td className="px-4 py-3 text-slate-600">{o.product?.name || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{o.totalPairs}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${isOverdue(o) ? 'text-red-600' : 'text-slate-500'}`}>
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
