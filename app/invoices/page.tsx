'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Plus, Loader2, Minus, ShoppingCart, User, Printer, Trash2, Search, AlertTriangle } from '@/app/components/icons';
import Link from 'next/link';
import { Pager } from '@/app/components/pager';
import { useSearchParams } from 'next/navigation';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Taslak',   color: 'bg-ink-100 text-ink-600' },
  PENDING:   { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Kısmi',    color: 'bg-brand-100 text-brand-800' },
  PAID:      { label: 'Ödendi',   color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'İptal',    color: 'bg-red-100 text-red-600' },
};

export default function InvoicesPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams?.get('customerId') ?? null;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Sunucu tarafı sayfalama: binlerce faturada sayfa tek seferde yüklenmez
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const h = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => { setPage(1); }, [query, customerIdParam]);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (query) params.set('q', query);
    if (customerIdParam) params.set('customerId', customerIdParam);
    fetch(`/api/invoices?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setInvoices(Array.isArray(d?.items) ? d.items : []);
        setTotal(d?.total ?? 0);
        setTotalPages(d?.totalPages ?? 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, query, customerIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const handleDelete = async (id: string, no: string) => {
    setConfirmModal({ message: `"${no}" silinecek.`, onConfirm: async () => {
      await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      load();
    }});
  };

  const filtered = invoices;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">{t('invoices', 'title')}</h1>
            <p className="text-ink-500 text-sm">{total.toLocaleString('tr-TR')} {t('invoices', 'title').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 border border-ink-200 rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <Search className="w-4 h-4 text-ink-400 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Müşteri veya belge no..."
                className="text-sm outline-none w-44 placeholder:text-ink-300"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-ink-300 hover:text-ink-500">
                  <Minus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Link href="/invoices/new"
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium transition-colors shadow-sm text-sm">
              <Plus className="w-4 h-4" /> {t('invoices', 'newInvoice')}
            </Link>
          </div>
        </div>

        {customerIdParam && (
          <div className="flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5">
            <span className="text-sm text-brand-900 font-medium">
              Müşteri: {invoices.find(inv => inv.customerId === customerIdParam)?.customer?.name ?? customerIdParam}
            </span>
            <Link href="/invoices" className="ml-auto flex items-center gap-1 px-3 py-1 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-lg text-xs font-medium transition-colors">
              ✕ Tüm satışlar
            </Link>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-card border border-ink-200/80">
            {search.trim() ? (
              <p className="text-ink-400 text-sm">{t('invoices', 'noResults')}</p>
            ) : (
              <>
                <p className="text-ink-400 text-sm mb-3">{t('invoices', 'empty')}</p>
                <Link href="/invoices/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Fatura kes
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-x-auto border border-ink-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 text-ink-500 text-[11px] font-semibold uppercase tracking-[0.08em] border-b border-ink-200">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-left">İsim/Unvan</th>
                  <th className="px-4 py-3 text-left">Belge No</th>
                  <th className="px-4 py-3 text-left">Sipariş No</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const isOpen = expandedId === inv.id;
                  return (
                    <>
                      {/* Main row */}
                      <tr
                        key={inv.id}
                        onClick={() => toggle(inv.id)}
                        className={`border-b border-ink-100 cursor-pointer transition-colors ${isOpen ? 'bg-ink-50' : 'hover:bg-ink-50/60'}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 text-xs font-bold ${
                            isOpen ? 'border-ink-500 text-ink-600 bg-ink-100' : 'border-ink-400 text-ink-500'
                          }`}>
                            {isOpen ? '−' : '+'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-600 whitespace-nowrap">
                          <div>{new Date(inv.date).toLocaleDateString('tr-TR')}</div>
                          <div className="text-xs text-ink-400">{new Date(inv.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink-800">{inv.customer?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{inv.invoiceNo}</td>
                        <td className="px-4 py-3 text-ink-600">{inv.soleOrder?.orderNo ?? '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${inv.isReturn ? 'text-red-600' : 'text-ink-800'}`}>
                          {inv.isReturn ? '−' : ''}{Math.abs(inv.total).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs font-normal text-ink-400 ml-1">{inv.currency}</span>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isOpen && (
                        <tr key={`${inv.id}-expanded`} className="border-b border-ink-200 bg-ink-50">
                          <td colSpan={6} className="px-6 py-4">
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-medium transition-colors"
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
                              <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden mb-3">
                                <thead>
                                  <tr className="bg-white border-b border-ink-200">
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-ink-600">Ürün</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-ink-600">Birim Fiyat</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-ink-600">Tutar (KDV Dahil)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100 bg-white">
                                  {inv.items.map((item: any) => (
                                    <tr key={item.id}>
                                      <td className="px-4 py-2.5 text-ink-700">
                                        {item.quantity > 0 && (
                                          <span className="text-ink-400 mr-1">{item.quantity} x</span>
                                        )}
                                        {item.description}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-ink-600">
                                        {item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-medium text-ink-800">
                                        {item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {/* Created by */}
                            {inv.createdBy?.name && (
                              <p className="text-xs text-ink-500 bg-white border border-ink-100 rounded-lg px-3 py-1.5 inline-block">
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
        {!loading && <Pager page={page} totalPages={totalPages} total={total} onChange={p => { setPage(p); window.scrollTo({ top: 0 }); }} />}
      </div>
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-800 mb-1">Emin misiniz?</h3>
                <p className="text-sm text-ink-600 whitespace-pre-line">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-ink-50">İptal</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
