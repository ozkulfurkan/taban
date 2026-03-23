'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { FileText, Plus, Trash2, Search, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Taslak',   color: 'bg-slate-100 text-slate-600' },
  PENDING:   { label: 'Bekleyen', color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Kısmi',    color: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Ödendi',   color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'İptal',    color: 'bg-red-100 text-red-600' },
};

const STATUS_FILTERS = ['Tümü', 'PENDING', 'PARTIAL', 'PAID', 'DRAFT', 'CANCELLED'];
const STATUS_FILTER_LABELS: Record<string, string> = {
  Tümü: 'Tümü', PENDING: 'Bekleyen', PARTIAL: 'Kısmi', PAID: 'Ödendi', DRAFT: 'Taslak', CANCELLED: 'İptal'
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tümü');

  const load = (status?: string) => {
    setLoading(true);
    const url = status && status !== 'Tümü' ? `/api/invoices?status=${status}` : '/api/invoices';
    fetch(url)
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const handleDelete = async (id: string, no: string) => {
    if (!confirm(`"${no}" faturası silinsin mi?`)) return;
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const filtered = invoices.filter(inv =>
    inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPending = invoices
    .filter(inv => inv.status === 'PENDING' || inv.status === 'PARTIAL')
    .reduce((s, inv) => s + (inv.total - inv.paidAmount), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Faturalar</h1>
            <p className="text-slate-500 text-sm">{invoices.length} fatura</p>
          </div>
          <Link href="/invoices/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Yeni Fatura
          </Link>
        </div>

        {totalPending > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              Toplam <span className="font-semibold">{totalPending.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span> tutarında bekleyen/kısmi alacak var.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {STATUS_FILTER_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Fatura no veya müşteri ara..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? 'Sonuç bulunamadı' : 'Henüz fatura eklenmedi'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Fatura No</th>
                  <th className="px-4 py-3 text-left">Müşteri</th>
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                  <th className="px-4 py-3 text-right">Kalan</th>
                  <th className="px-4 py-3 text-center">Durum</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv, i) => {
                  const st = STATUS_LABELS[inv.status] ?? STATUS_LABELS.PENDING;
                  const remaining = inv.total - inv.paidAmount;
                  return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{inv.invoiceNo}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.customer?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(inv.date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {inv.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{inv.currency}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={remaining > 0 ? 'font-medium text-red-500' : 'text-green-600'}>
                          {remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/invoices/${inv.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button onClick={() => handleDelete(inv.id, inv.invoiceNo)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
