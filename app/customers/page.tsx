'use client';

import { useEffect, useRef, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Users, Plus, Loader2, Search, Upload, Download, X, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/customers/import', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
      if (data.created > 0) onDone();
    } catch {
      setResult({ created: 0, skipped: 0, errors: ['Sunucu hatası oluştu.'] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4" /> Müşteri İçeri Aktar
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Şablon dosyası</p>
              <p className="text-xs text-slate-400 mt-0.5">Doldurup yükleyin. Müşteri Adı ve Para Birimi zorunlu.</p>
            </div>
            <a href="/api/customers/import/template"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              <Download className="w-4 h-4 text-blue-500" /> İndir
            </a>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Excel Dosyası (.xlsx)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              {file ? (
                <p className="text-sm font-medium text-blue-600">{file.name}</p>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Dosya seçmek için tıklayın</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-green-700 font-medium">{result.created} müşteri başarıyla eklendi</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-700">{result.skipped} satır atlandı</span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              {result ? 'Kapat' : 'Vazgeç'}
            </button>
            {!result && (
              <button onClick={handleUpload} disabled={!file || loading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Yükle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadCustomers = (p = page, s = debouncedSearch) => {
    setLoading(true);
    fetch(`/api/customers?page=${p}&search=${encodeURIComponent(s)}`)
      .then(r => r.json())
      .then(d => {
        setCustomers(Array.isArray(d.customers) ? d.customers : []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 0);
      })
      .catch(console.error)
      .finally(() => { setLoading(false); setHasLoaded(true); });
  };

  useEffect(() => { loadCustomers(page, debouncedSearch); }, [page, debouncedSearch]);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('customers', 'title')}</h1>
            <p className="text-slate-500 text-sm">{total} {t('customers', 'title').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors shadow-sm text-sm">
              <Upload className="w-4 h-4 text-blue-500" /> İçeri Aktar
            </button>
            <Link href="/customers/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> {t('customers', 'newCustomer')}
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('customers', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm" />
        </div>

        {/* Table */}
        {(loading && !hasLoaded) ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className={loading ? 'opacity-50 pointer-events-none transition-opacity duration-150' : 'transition-opacity duration-150'}>
            {!customers.length ? (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-3">{search ? t('customers', 'noResults') : t('customers', 'empty')}</p>
                {!search && (
                  <Link href="/customers/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> Müşteri ekle
                  </Link>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_160px_140px] items-center px-4 py-2.5 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide">
                  <span>{t('customers', 'nameTitle')}</span>
                  <span className="text-right">{t('customers', 'openBalance')}</span>
                  <span className="text-right pr-1">{t('customers', 'totalInvoiced')}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {customers.map(c => (
                    <Link key={c.id} href={`/customers/${c.id}`}
                      className="grid grid-cols-[1fr_160px_140px] items-center hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="block w-full bg-blue-600 group-hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors truncate">
                          {c.name}
                        </span>
                        {c.phone && (
                          <span className="flex-shrink-0 bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                            {c.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-right pr-4 py-2">
                        <span className={`text-sm font-semibold ${c.balance > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                          {(c.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs font-normal ml-1 opacity-70">{c.currency}</span>
                        </span>
                      </div>
                      <div className="text-right pr-4 py-2">
                        <span className="text-sm text-slate-500">
                          {(c.totalInvoiced || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs font-normal ml-1 opacity-70">{c.currency}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                    <span className="text-sm text-slate-500">
                      {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} / {total} müşteri
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-1 text-sm font-medium text-slate-700">
                        {page} / {totalPages}
                      </span>
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setPage(1); loadCustomers(1, debouncedSearch); }}
        />
      )}
    </AppShell>
  );
}
