'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { FileText, Plus, Trash2, Search, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';

export default function InvoicesPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams?.get('customerId') ?? null;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const STATUS_LABELS = () => ({
    DRAFT:     { label: t('invoices', 'statusDraft'),     color: 'bg-slate-100 text-slate-600' },
    PENDING:   { label: t('invoices', 'statusPending'),   color: 'bg-yellow-100 text-yellow-700' },
    PARTIAL:   { label: t('invoices', 'statusPartial'),   color: 'bg-blue-100 text-blue-700' },
    PAID:      { label: t('invoices', 'statusPaid'),      color: 'bg-green-100 text-green-700' },
    CANCELLED: { label: t('invoices', 'statusCancelled'), color: 'bg-red-100 text-red-600' },
  } as Record<string, { label: string; color: string }>);

  const STATUS_FILTERS = ['ALL', 'PENDING', 'PARTIAL', 'PAID', 'DRAFT', 'CANCELLED'];

  const load = (status?: string) => {
    setLoading(true);
    const url = status && status !== 'ALL' ? `/api/invoices?status=${status}` : '/api/invoices';
    fetch(url)
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const handleDelete = async (id: string, no: string) => {
    if (!confirm(`"${no}" ${t('invoices', 'statusDraft')}?`)) return;
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const filtered = invoices.filter(inv => {
    if (customerIdParam && inv.customerId !== customerIdParam) return false;
    return (
      inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalPending = invoices
    .filter(inv => inv.status === 'PENDING' || inv.status === 'PARTIAL')
    .reduce((s, inv) => s + (inv.total - inv.paidAmount), 0);

  const statusLabels = STATUS_LABELS();

  const getFilterLabel = (s: string) => {
    if (s === 'ALL') return t('invoices', 'all');
    return statusLabels[s]?.label ?? s;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('invoices', 'title')}</h1>
            <p className="text-slate-500 text-sm">{invoices.length} {t('invoices', 'title').toLowerCase()}</p>
          </div>
          <Link href="/invoices/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> {t('invoices', 'newInvoice')}
          </Link>
        </div>

        {totalPending > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              {t('common', 'total')} <span className="font-semibold">{totalPending.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span> {t('invoices', 'pendingAlert')}
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
              {getFilterLabel(s)}
            </button>
          ))}
        </div>

        {customerIdParam && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
            <span className="text-sm text-blue-800 font-medium">
              Müşteri: {invoices.find(inv => inv.customerId === customerIdParam)?.customer?.name ?? customerIdParam}
            </span>
            <Link href="/invoices" className="ml-auto flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors">
              ✕ Tüm satışlar
            </Link>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('invoices', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? t('invoices', 'noResults') : t('invoices', 'empty')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{t('invoices', 'invoiceNo')}</th>
                  <th className="px-4 py-3 text-left">{t('invoices', 'customer')}</th>
                  <th className="px-4 py-3 text-left">{t('common', 'date')}</th>
                  <th className="px-4 py-3 text-right">{t('invoices', 'amount')}</th>
                  <th className="px-4 py-3 text-right">{t('invoices', 'remaining')}</th>
                  <th className="px-4 py-3 text-center">{t('invoices', 'status')}</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv, i) => {
                  const st = statusLabels[inv.status] ?? statusLabels.PENDING;
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
                      <td className="px-4 py-3 text-slate-500">
                        <div>{new Date(inv.date).toLocaleDateString('tr-TR')}</div>
                        <div className="text-xs text-slate-400">{new Date(inv.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
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
