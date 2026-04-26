'use client';

import { useEffect, useState, useRef } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Truck, Plus, Loader2, Search, Upload, Download } from 'lucide-react';
import Link from 'next/link';

export default function SuppliersPage() {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/suppliers')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/suppliers/import', { method: 'POST', body: fd });
      const data = await res.json();
      setImportResult(data);
      if (data.created > 0) {
        const updated = await fetch('/api/suppliers').then(r => r.json());
        setSuppliers(Array.isArray(updated) ? updated : []);
      }
    } catch { setImportResult({ created: 0, skipped: 0, errors: ['Yükleme sırasında hata oluştu'] }); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('suppliers', 'title')}</h1>
            <p className="text-slate-500 text-sm">{suppliers.length} {t('suppliers', 'title').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.location.href = '/api/suppliers/import/template'}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Şablon
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-3 py-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Excel'den İçe Aktar
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Link
              href="/suppliers/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> {t('suppliers', 'newSupplier')}
            </Link>
          </div>
        </div>

        {/* Import result banner */}
        {importResult && (
          <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${importResult.errors.length > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
            <div className="flex-1">
              <p className="font-semibold">{importResult.created} tedarikçi eklendi, {importResult.skipped} atlandı.</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">{importResult.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}</ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600 mt-0.5">✕</button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('suppliers', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-3">{search ? t('suppliers', 'noResults') : t('suppliers', 'empty')}</p>
            {!search && (
              <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Tedarikçi ekle
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_180px] items-center px-4 py-2.5 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide">
              <span>{t('suppliers', 'nameTitle')}</span>
              <span className="text-right pr-1">{t('suppliers', 'openBalance')}</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map(s => (
                <Link
                  key={s.id}
                  href={`/suppliers/${s.id}`}
                  className="grid grid-cols-[1fr_180px] items-center hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Name cell — full-width button */}
                  <div className="px-3 py-2">
                    <span className="block w-full bg-emerald-600 group-hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors truncate">
                      {s.name}
                    </span>
                  </div>

                  {/* Balance */}
                  <div className="text-right pr-4 py-2">
                    <span className={`text-sm font-semibold ${s.balance > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                      {(s.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-normal ml-1 opacity-70">{s.currency}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
