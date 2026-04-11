'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Plus, Loader2, Minus, ShoppingCart, User, Printer, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Taslak',   color: 'bg-slate-100 text-slate-600' },
  PENDING:   { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Kısmi',    color: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Ödendi',   color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'İptal',    color: 'bg-red-100 text-red-600' },
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'PARTIAL', 'PAID', 'DRAFT', 'CANCELLED'];

export default function InvoicesPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams?.get('customerId') ?? null;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const handleDelete = async (id: string, no: string) => {
    if (!confirm(`"${no}" silinsin mi?`)) return;
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const filtered = invoices.filter(inv => {
    if (customerIdParam && inv.customerId !== customerIdParam) return false;
    if (search.length >= 3) {
      const q = search.toLowerCase();
      return (
        inv.invoiceNo?.toLowerCase().includes(q) ||
        inv.customer?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('invoices', 'title')}</h1>
            <p className="text-slate-500 text-sm">{invoices.length} {t('invoices', 'title').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Ara:</span>
              <select className="text-sm text-slate-600 outline-none bg-transparent border-r border-slate-200 pr-2 mr-1">
                <option>Müşteri İsmi / Belge No</option>
              </select>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="arama... (en az 3)"
                className="text-sm outline-none w-40 placeholder:text-slate-300"
              />
            </div>
            <Link href="/invoices/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm">
              <Plus className="w-4 h-4" /> {t('invoices', 'newInvoice')}
            </Link>
          </div>
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

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s === 'ALL' ? t('invoices', 'all') : (STATUS_LABELS[s]?.label ?? s)}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm text-slate-400 text-sm">
            {search.length >= 3 ? t('invoices', 'noResults') : t('invoices', 'empty')}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-left">İsim/Unvan</th>
                  <th className="px-4 py-3 text-left">Belge No</th>
                  <th className="px-4 py-3 text-left">Sipariş No</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                  <th className="px-4 py-3 text-center w-24">Durum</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const isOpen = expandedId === inv.id;
                  const st = STATUS_LABELS[inv.status] ?? STATUS_LABELS.PENDING;
                  return (
                    <>
                      {/* Main row */}
                      <tr
                        key={inv.id}
                        onClick={() => toggle(inv.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 text-xs font-bold ${
                            isOpen ? 'border-slate-500 text-slate-600 bg-slate-100' : 'border-slate-400 text-slate-500'
                          }`}>
                            {isOpen ? '−' : '+'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          <div>{new Date(inv.date).toLocaleDateString('tr-TR')}</div>
                          <div className="text-xs text-slate-400">{new Date(inv.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{inv.customer?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{inv.invoiceNo}</td>
                        <td className="px-4 py-3 text-slate-400">—</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {inv.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs font-normal text-slate-400 ml-1">{inv.currency}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isOpen && (
                        <tr key={`${inv.id}-expanded`} className="border-b border-slate-200 bg-slate-50">
                          <td colSpan={7} className="px-6 py-4">
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              <Link
                                href={`/invoices/${inv.id}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" /> Satış ekranına git
                              </Link>
                              <Link
                                href={`/customers/${inv.customerId}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <User className="w-3.5 h-3.5" /> Müşteri ekranına git
                              </Link>
                              <Link
                                href={`/invoices/${inv.id}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" /> Yazdır
                              </Link>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(inv.id, inv.invoiceNo); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-500 border border-red-200 rounded-lg text-xs font-medium transition-colors ml-auto"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Sil
                              </button>
                            </div>

                            {/* Items table */}
                            {inv.items && inv.items.length > 0 && (
                              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mb-3">
                                <thead>
                                  <tr className="bg-white border-b border-slate-200">
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Ürün</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Birim Fiyat</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Tutar (KDV Dahil)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {inv.items.map((item: any) => (
                                    <tr key={item.id}>
                                      <td className="px-4 py-2.5 text-slate-700">
                                        {item.quantity > 0 && (
                                          <span className="text-slate-400 mr-1">{item.quantity} x</span>
                                        )}
                                        {item.description}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-slate-600">
                                        {item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                                        {item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {/* Created by */}
                            {inv.createdBy?.name && (
                              <p className="text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-3 py-1.5 inline-block">
                                Kullanıcı : {inv.createdBy.name}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
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
