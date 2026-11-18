'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AppShell from '@/app/components/app-shell';
import { formatDate } from '@/lib/time';
import { useLanguage } from '@/lib/i18n/language-context';
import { Loader2, ChevronLeft, ChevronRight, RefreshCw, X, AlertTriangle, Upload, Download, CheckCircle2, AlertCircle, Landmark, Truck, Wallet } from 'lucide-react';
import { matchesText } from '@/lib/search';
import FitText from '@/app/components/fit-text';
import { vadeTone, daysToVade, weightedAvgVade, totalsByCurrency } from '@/lib/cek';
import type { Rates } from '@/lib/fx';
import { BankModal, CollectModal, SupplierPayModal } from './bulk-modals';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;

type SortDir = 'asc' | 'desc';

const DURUM_COLOR: Record<string, string> = {
  PORTFOY: 'bg-blue-100 text-blue-700',
  BANKAYA_VERILDI: 'bg-purple-100 text-purple-700',
  TEDARIKCI_VERILDI: 'bg-orange-100 text-orange-700',
  ODENDI: 'bg-green-100 text-green-700',
  KARSILIKS: 'bg-red-100 text-red-700',
  IPTAL: 'bg-slate-100 text-slate-600',
};

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
      const res = await fetch('/api/cek/import', { method: 'POST', body: fd });
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
        <div className="bg-teal-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4" /> Çek İçeri Aktar
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Şablon dosyası</p>
              <p className="text-xs text-slate-400 mt-0.5">Gerekli sütunlar: Müşteri Adı, Vadesi, Çek No, Bankası, Tutar</p>
            </div>
            <a href="/api/cek/import/template"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              <Download className="w-4 h-4 text-teal-500" /> İndir
            </a>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Excel Dosyası (.xlsx)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              {file ? (
                <p className="text-sm font-medium text-teal-600">{file.name}</p>
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

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            İçeri aktarılan çekler müşteri hesabına <strong>yansımaz</strong> ve müşteri detay sayfasında <strong>görünmez</strong>.
          </div>

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-green-700 font-medium">{result.created} çek başarıyla aktarıldı</span>
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
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
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

export default function CekPortfoyuPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('PORTFOY');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('vadesi');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ cek: any; durum: string } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [vadeFilter, setVadeFilter] = useState<'' | 'overdue' | 'week'>('');
  // Seçim sayfalar arasında korunur
  const [selected, setSelected] = useState<Map<string, any>>(new Map());
  const [bulk, setBulk] = useState<null | { kind: 'bank' | 'supplier' | 'collect'; cekler: any[] }>(null);
  const [rates, setRates] = useState<Rates>({});
  useEffect(() => { fetch('/api/exchange-rates').then(r => r.json()).then(d => { if (d?.usd || d?.eur) setRates(d); }).catch(() => {}); }, []);

  const DURUM_LABEL: Record<string, string> = {
    PORTFOY: t('checks', 'statusPortfoy'),
    BANKAYA_VERILDI: t('checks', 'statusBankaya'),
    TEDARIKCI_VERILDI: t('checks', 'statusTedarikci'),
    ODENDI: t('checks', 'statusOdendi'),
    KARSILIKS: t('checks', 'statusKarsiliks'),
    IPTAL: t('checks', 'statusIptal'),
  };

  const TABS = [
    { key: '', label: t('checks', 'all') },
    { key: 'PORTFOY', label: t('checks', 'inPortfolio') },
    { key: 'TEDARIKCI_VERILDI', label: t('checks', 'sentToSupplier') },
    { key: 'BANKAYA_VERILDI', label: t('checks', 'sentToBank') },
    { key: 'ODENDI', label: t('checks', 'paid') },
    { key: 'KARSILIKS', label: t('checks', 'bounced') },
    { key: 'IPTAL', label: t('checks', 'cancelled') },
  ];

  const ISLEMLER = [
    { key: 'PORTFOY', label: t('checks', 'addToPortfolio') },
    { key: 'BANKAYA_VERILDI', label: t('checks', 'sendToBank') },
    { key: 'TEDARIKCI_VERILDI', label: t('checks', 'sendToSupplier') },
    { key: 'ODENDI', label: t('checks', 'collect') },
    { key: 'KARSILIKS', label: t('checks', 'markBounced') },
    { key: 'IPTAL', label: t('checks', 'cancelCheck') },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), sortBy, sortDir });
      if (tab) qs.set('durum', tab);
      if (vadeFilter) qs.set('vade', vadeFilter);
      const res = await fetch(`/api/cek?${qs}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }, [tab, page, sortBy, sortDir, vadeFilter]);

  // İşlemden sonra liste yenilenir ve seçim temizlenir
  const afterBulk = () => { setSelected(new Map()); load(); };
  const toggle = (c: any) => setSelected(prev => {
    const n = new Map(prev);
    if (n.has(c.id)) n.delete(c.id); else n.set(c.id, c);
    return n;
  });

  useEffect(() => { load(); }, [load]);

  const handleTabChange = (key: string) => {
    setTab(key);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-teal-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleDurumChange = (cek: any, durum: string) => {
    setOpenDropdown(null);
    setMenuPos(null);
    if (durum === 'ODENDI') { setBulk({ kind: 'collect', cekler: [cek] }); return; }
    if (durum === 'BANKAYA_VERILDI' && cek.durum === 'PORTFOY') { setBulk({ kind: 'bank', cekler: [cek] }); return; }
    if (durum === 'TEDARIKCI_VERILDI' && cek.durum === 'PORTFOY') { setBulk({ kind: 'supplier', cekler: [cek] }); return; }
    if (durum === 'PORTFOY' && (cek.durum === 'TEDARIKCI_VERILDI' || (cek.durum === 'ODENDI' && cek.paymentId))) {
      setConfirmModal({ cek, durum });
      return;
    }
    applyDurumChange(cek.id, durum, false, false);
  };

  const applyDurumChange = async (id: string, durum: string, removeSupplierPayment: boolean, removePayment: boolean) => {
    await fetch(`/api/cek/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durum,
        ...(removeSupplierPayment ? { removeSupplierPayment: true } : {}),
        ...(removePayment ? { removePayment: true } : {}),
      }),
    });
    setSelected(prev => { const n = new Map(prev); n.delete(id); return n; });
    load();
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmModal({ message: t('checks', 'deleteConfirm'), onConfirm: async () => {
      await fetch(`/api/cek/${id}`, { method: 'DELETE' });
      load();
    }});
  };

  const cekler: any[] = data?.cekler || [];
  const totalPages = data?.pages || 1;

  const filtered = search
    ? cekler.filter(c =>
        matchesText(c.borclu, search.toLowerCase()) ||
        matchesText(c.seriNo, search.toLowerCase()) ||
        matchesText(c.bankasi, search.toLowerCase())
      )
    : cekler;

  // Özet: döviz bazında (API tüm eşleşen kayıtlar üzerinden hesaplar)
  const totals: Array<{ currency: string; count: number; total: number; avgVadeMs: number | null }> = data?.totals ?? [];

  const sel = Array.from(selected.values());
  const selAvg = weightedAvgVade(sel, rates);
  const selTotals = totalsByCurrency(sel);
  const allPortfoy = sel.length > 0 && sel.every(c => c.durum === 'PORTFOY');
  const allBank = sel.length > 0 && sel.every(c => c.durum === 'BANKAYA_VERILDI');
  const pageAllSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const togglePage = () => setSelected(prev => {
    const n = new Map(prev);
    if (pageAllSelected) filtered.forEach(c => n.delete(c.id)); else filtered.forEach(c => n.set(c.id, c));
    return n;
  });
  const VADE_TEXT = { overdue: 'text-red-600', soon: 'text-orange-600', normal: 'text-slate-500' } as const;
  const vadeNote = (c: any) => {
    const tone = vadeTone(c);
    if (tone === 'normal') return null;
    const d = daysToVade(c.vadesi);
    return tone === 'overdue' ? `${-d} gün geçti` : d === 0 ? 'bugün' : `${d} gün kaldı`;
  };

  return (
    <AppShell>
      <div className={`space-y-5 ${sel.length ? 'pb-40 lg:pb-0' : ''}`}>
        <div className="bg-teal-600 rounded-xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-white font-bold text-lg uppercase tracking-wide">{t('checks', 'title')}</h1>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" /> İçeri Aktar
          </button>
        </div>

        {/* Seçim çubuğu: masaüstünde sağ üstte, telefonda altta sabit */}
        {sel.length > 0 && (
          <div role="region" aria-label="Seçili çekler"
            className="fixed bottom-[60px] inset-x-0 z-30 lg:sticky lg:bottom-auto lg:inset-x-auto lg:top-16 lg:ml-auto lg:w-[460px] bg-white border border-slate-200 shadow-xl lg:rounded-xl p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                <p className="font-semibold text-slate-800">{sel.length} çek seçildi</p>
                <p className="text-slate-600 tabular-nums">{selTotals.map(x => `${fmt(x.total)} ${x.currency}`).join(' + ')}</p>
                {selAvg && (
                  <p className="text-slate-600">Ortalama vade: <b data-testid="sel-avg-vade">{fmtDate(selAvg.date)}</b> ({selAvg.days} {t('checks', 'days')})</p>
                )}
              </div>
              <button onClick={() => setSelected(new Map())} className="text-xs text-slate-500 hover:text-slate-800 underline flex-shrink-0">Seçimi temizle</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={!allPortfoy} title={allPortfoy ? '' : 'Sadece portföydeki çekler bankaya verilebilir'}
                onClick={() => setBulk({ kind: 'bank', cekler: sel })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40">
                <Landmark className="w-3.5 h-3.5" /> Bankaya Gönder
              </button>
              <button disabled={!allPortfoy} title={allPortfoy ? '' : 'Sadece portföydeki çekler tedarikçiye verilebilir'}
                onClick={() => setBulk({ kind: 'supplier', cekler: sel })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold disabled:opacity-40">
                <Truck className="w-3.5 h-3.5" /> Tedarikçiye Ödeme Yap
              </button>
              <button disabled={!allBank} title={allBank ? '' : 'Bankadaki çekler tahsil edilebilir'}
                onClick={() => setBulk({ kind: 'collect', cekler: sel })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40">
                <Wallet className="w-3.5 h-3.5" /> Tahsil Et
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="flex border-b border-slate-100 min-w-max">
            {TABS.map(tb => (
              <button key={tb.key} onClick={() => handleTabChange(tb.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tab === tb.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hızlı vade filtreleri */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vade filtresi">
          {([['', 'Tüm vadeler'], ['overdue', 'Vadesi geçmiş'], ['week', '7 gün içinde']] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setVadeFilter(k); setPage(1); }} aria-pressed={vadeFilter === k}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                vadeFilter === k
                  ? k === 'overdue' ? 'bg-red-600 border-red-600 text-white' : k === 'week' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Özet: döviz bazında */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(totals.length ? totals : [{ currency: 'TRY', count: 0, total: 0, avgVadeMs: null }]).map(tt => (
            <div key={tt.currency} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 mb-1">{tt.currency} · {tt.count} {t('checks', 'count').toLowerCase()}</p>
              <FitText className="text-2xl font-bold text-slate-800">{`${fmt(tt.total)} ${tt.currency}`}</FitText>
              <p className="text-xs text-slate-500 mt-1">
                {t('checks', 'avgMaturity')}: {tt.avgVadeMs ? `${fmtDate(new Date(tt.avgVadeMs))} (${daysToVade(new Date(tt.avgVadeMs))} ${t('checks', 'days')})` : '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Refresh */}
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('checks', 'searchPlaceholder')}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">{t('checks', 'noResults')}</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-[36px]" />
                  <col className="w-[22%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50 select-none">
                    <th className="px-2 py-2.5">
                      <input type="checkbox" aria-label="Sayfadaki tüm çekleri seç" checked={pageAllSelected} onChange={togglePage}
                        className="w-4 h-4 rounded border-slate-300 accent-teal-600" />
                    </th>
                    {[
                      { label: t('checks', 'debtor'), field: 'borclu', align: 'left' },
                      { label: t('checks', 'receivedDate'), field: 'islemTarihi', align: 'left' },
                      { label: t('checks', 'maturity'), field: 'vadesi', align: 'left' },
                      { label: t('checks', 'bank'), field: 'bankasi', align: 'left' },
                      { label: t('checks', 'no'), field: 'seriNo', align: 'left' },
                      { label: t('checks', 'description'), field: '', align: 'left' },
                      { label: t('checks', 'amount'), field: 'tutar', align: 'right' },
                      { label: t('checks', 'status'), field: 'durum', align: 'center' },
                      { label: t('checks', 'actions'), field: '', align: 'center' },
                    ].map(col => (
                      <th
                        key={col.label}
                        onClick={() => col.field && handleSort(col.field)}
                        className={`px-2 py-2.5 text-${col.align} ${col.field ? 'cursor-pointer hover:text-slate-700 hover:bg-slate-100' : ''} transition-colors`}
                      >
                        {col.label}{col.field && <SortIcon field={col.field} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const tone = vadeTone(c);
                    return (
                    <tr key={c.id} data-vade={tone}
                      className={`border-b border-slate-100 ${selected.has(c.id) ? 'bg-teal-50' : tone === 'overdue' ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-2 py-2">
                        <input type="checkbox" aria-label={`${c.borclu} ${c.seriNo || ''} çekini seç`} checked={selected.has(c.id)} onChange={() => toggle(c)}
                          className="w-4 h-4 rounded border-slate-300 accent-teal-600" />
                      </td>
                      <td className={`px-2 py-2 font-medium max-w-0 truncate ${tone === 'overdue' ? 'text-red-700' : 'text-slate-800'}`} title={c.borclu}>{c.borclu}</td>
                      <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{fmtDate(c.islemTarihi)}</td>
                      <td className={`px-2 py-2 whitespace-nowrap ${VADE_TEXT[tone]} ${tone !== 'normal' ? 'font-semibold' : ''}`}>
                        {fmtDate(c.vadesi)}
                        {vadeNote(c) && <span className="block text-[11px] font-medium">{vadeNote(c)}</span>}
                      </td>
                      <td className="px-2 py-2 text-slate-500 truncate max-w-0" title={c.bankasi || ''}>{c.bankasi || '—'}</td>
                      <td className="px-2 py-2 text-slate-600 font-medium truncate max-w-0">{c.seriNo || '—'}</td>
                      <td className="px-2 py-2 text-slate-500 truncate max-w-0" title={c.aciklama || c.islem}>
                        {c.durum === 'BANKAYA_VERILDI' && c.bankAccount ? `${c.bankAccount.name} — ` : ''}{c.aciklama || c.islem}
                      </td>
                      <td className={`px-2 py-2 text-right font-semibold whitespace-nowrap ${tone === 'overdue' ? 'text-red-700' : 'text-slate-800'}`}>{fmt(c.tutar)} {c.currency}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DURUM_COLOR[c.durum] || 'bg-slate-100 text-slate-600'}`}>
                          {DURUM_LABEL[c.durum] || c.durum}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={(e) => {
                            if (openDropdown === c.id) {
                              setOpenDropdown(null);
                              setMenuPos(null);
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenDropdown(c.id);
                            }
                          }}
                          className="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap"
                        >
                          {t('checks', 'actions')} ▾
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Telefon: seçilebilir kartlar */}
            <div className="sm:hidden">
              <label className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 text-xs text-slate-500">
                <input type="checkbox" checked={pageAllSelected} onChange={togglePage} className="w-4 h-4 accent-teal-600" /> Sayfadakilerin tümünü seç
              </label>
              <ul className="divide-y divide-slate-100">
                {filtered.map(c => {
                  const tone = vadeTone(c);
                  return (
                    <li key={c.id} data-vade={tone} className={`flex items-start gap-3 px-4 py-3 ${selected.has(c.id) ? 'bg-teal-50' : tone === 'overdue' ? 'bg-red-50/60' : ''}`}>
                      <input type="checkbox" aria-label={`${c.borclu} çekini seç`} checked={selected.has(c.id)} onChange={() => toggle(c)} className="mt-1 w-5 h-5 accent-teal-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <p className={`font-medium truncate ${tone === 'overdue' ? 'text-red-700' : 'text-slate-800'}`}>{c.borclu}</p>
                          <p className={`font-semibold whitespace-nowrap tabular-nums ${tone === 'overdue' ? 'text-red-700' : 'text-slate-800'}`}>{fmt(c.tutar)} {c.currency}</p>
                        </div>
                        <div className="flex justify-between gap-2 mt-0.5 text-xs">
                          <span className={`${VADE_TEXT[tone]} ${tone !== 'normal' ? 'font-semibold' : ''}`}>Vade {fmtDate(c.vadesi)}{vadeNote(c) ? ` · ${vadeNote(c)}` : ''}</span>
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${DURUM_COLOR[c.durum] || 'bg-slate-100 text-slate-600'}`}>{DURUM_LABEL[c.durum] || c.durum}</span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{[c.bankasi, c.seriNo].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                      <button aria-label="İşlemler"
                        onClick={(e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setOpenDropdown(c.id); }}
                        className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded-lg">⋯</button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">{t('checks', 'page')} {page} / {totalPages} — {data.total} {t('checks', 'records')}</span>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Row dropdown — fixed position so overflow-x-auto doesn't clip it */}
      {openDropdown && menuPos && (() => {
        const cek = filtered.find(c => c.id === openDropdown);
        if (!cek) return null;
        return (
          <>
            <div className="fixed inset-0 z-30" onClick={() => { setOpenDropdown(null); setMenuPos(null); }} />
            <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }} className="bg-white rounded-xl shadow-lg border border-slate-100 z-40 min-w-[220px] overflow-hidden">
              {ISLEMLER.filter(i => i.key !== cek.durum && (cek.durum === 'PORTFOY' || (i.key !== 'TEDARIKCI_VERILDI' && i.key !== 'BANKAYA_VERILDI'))).map(i => (
                <button key={i.key} onClick={() => handleDurumChange(cek, i.key)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  {i.label}
                </button>
              ))}
              <div className="border-t border-slate-100" />
              <button onClick={() => { setOpenDropdown(null); setMenuPos(null); handleDelete(cek.id); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                {t('checks', 'deleteCheck')}
              </button>
            </div>
          </>
        );
      })()}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { load(); }}
        />
      )}

      {bulk?.kind === 'bank' && <BankModal cekler={bulk.cekler} onClose={() => setBulk(null)} onDone={afterBulk} />}
      {bulk?.kind === 'collect' && <CollectModal cekler={bulk.cekler} onClose={() => setBulk(null)} onDone={afterBulk} />}
      {bulk?.kind === 'supplier' && <SupplierPayModal cekler={bulk.cekler} onClose={() => setBulk(null)} onDone={afterBulk} />}

      {/* Confirm modal: → PORTFOY (tedarikçi veya tahsil edilmiş) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-500 text-lg">⚠</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Çek Portföye Geri Alınıyor</h3>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">{confirmModal.cek.borclu}</span> çeki{' '}
                  {confirmModal.cek.durum === 'ODENDI' ? 'tahsil edilmiş' : 'tedarikçiye verilmiş'} durumda.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              {confirmModal.cek.durum === 'ODENDI'
                ? 'Portföye geri alındığında kasadaki tahsilat kaydı otomatik olarak silinecek ve kasa bakiyesi güncellecek.'
                : 'Portföye geri alındığında tedarikçi hesabından ilgili çek ödemesi otomatik olarak silinecek ve bakiye güncellecek.'}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Vazgeç
              </button>
              <button
                onClick={() => {
                  const isOdendi = confirmModal.cek.durum === 'ODENDI';
                  applyDurumChange(confirmModal.cek.id, confirmModal.durum, !isOdendi, isOdendi);
                  setConfirmModal(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
                Evet, Portföye Al
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Emin misiniz?</h3>
                <p className="text-sm text-slate-600 whitespace-pre-line">{deleteConfirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">İptal</button>
              <button onClick={() => { const fn = deleteConfirmModal.onConfirm; setDeleteConfirmModal(null); fn(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
