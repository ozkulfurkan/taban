'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/app/components/app-shell';
import { formatDate } from '@/lib/time';
import { useLanguage } from '@/lib/i18n/language-context';
import { Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;

const DURUM_COLOR: Record<string, string> = {
  PORTFOY: 'bg-blue-100 text-blue-700',
  BANKAYA_VERILDI: 'bg-purple-100 text-purple-700',
  TEDARIKCI_VERILDI: 'bg-orange-100 text-orange-700',
  ODENDI: 'bg-green-100 text-green-700',
  KARSILIKS: 'bg-red-100 text-red-700',
  IPTAL: 'bg-slate-100 text-slate-600',
};

function calcAvgVade(cekler: any[]) {
  const total = cekler.reduce((s, c) => s + Number(c.tutar), 0);
  if (!total) return null;
  const today = Date.now();
  const weightedDays = cekler.reduce((s, c) => {
    const daysToVade = (new Date(c.vadesi).getTime() - today) / 86400000;
    return s + Number(c.tutar) * daysToVade;
  }, 0);
  const avgDays = Math.round(weightedDays / total);
  const avgDate = new Date(today + avgDays * 86400000);
  return { date: avgDate, days: avgDays };
}

export default function CekPortfoyuPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ cek: any; durum: string } | null>(null);

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
      const qs = new URLSearchParams({ page: String(page) });
      if (tab) qs.set('durum', tab);
      const res = await fetch(`/api/cek?${qs}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  const handleTabChange = (key: string) => {
    setTab(key);
    setPage(1);
  };

  const handleDurumChange = (cek: any, durum: string) => {
    setOpenDropdown(null);
    if (cek.durum === 'TEDARIKCI_VERILDI' && durum === 'PORTFOY') {
      setConfirmModal({ cek, durum });
      return;
    }
    applyDurumChange(cek.id, durum, false);
  };

  const applyDurumChange = async (id: string, durum: string, removeSupplierPayment: boolean) => {
    await fetch(`/api/cek/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durum, ...(removeSupplierPayment ? { removeSupplierPayment: true } : {}) }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('checks', 'deleteConfirm'))) return;
    await fetch(`/api/cek/${id}`, { method: 'DELETE' });
    load();
  };

  const cekler: any[] = data?.cekler || [];
  const totalPages = data?.pages || 1;

  const filtered = search
    ? cekler.filter(c =>
        c.borclu?.toLowerCase().includes(search.toLowerCase()) ||
        c.seriNo?.toLowerCase().includes(search.toLowerCase()) ||
        c.bankasi?.toLowerCase().includes(search.toLowerCase())
      )
    : cekler;

  const totalTutar = filtered.reduce((s, c) => s + c.tutar, 0);
  const avgVade = calcAvgVade(filtered);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="bg-teal-600 rounded-xl px-6 py-4">
          <h1 className="text-white font-bold text-lg uppercase tracking-wide">{t('checks', 'title')}</h1>
        </div>

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

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-orange-500 rounded-xl p-4 text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('checks', 'count')}</p>
            <p className="text-2xl font-bold">{data?.total ?? '—'}</p>
          </div>
          <div className="bg-blue-500 rounded-xl p-4 text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('checks', 'totalAmount')}</p>
            <p className="text-2xl font-bold">{fmt(totalTutar)} TL</p>
          </div>
          <div className="bg-emerald-500 rounded-xl p-4 text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('checks', 'avgMaturity')}</p>
            <p className="text-xl font-bold">
              {avgVade ? `${fmtDate(avgVade.date)} (${avgVade.days} ${t('checks', 'days')})` : '—'}
            </p>
          </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                    <th className="px-3 py-2.5 text-left">{t('checks', 'debtor')}</th>
                    <th className="px-3 py-2.5 text-left">{t('checks', 'receivedDate')}</th>
                    <th className="px-3 py-2.5 text-left">{t('checks', 'maturity')}</th>
                    <th className="px-3 py-2.5 text-left">{t('checks', 'bank')}</th>
                    <th className="px-3 py-2.5 text-left">{t('checks', 'no')}</th>
                    <th className="px-3 py-2.5 text-left">{t('checks', 'description')}</th>
                    <th className="px-3 py-2.5 text-right">{t('checks', 'amount')}</th>
                    <th className="px-3 py-2.5 text-center">{t('checks', 'status')}</th>
                    <th className="px-3 py-2.5 text-center">{t('checks', 'actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{c.borclu}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(c.islemTarihi)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(c.vadesi)}</td>
                      <td className="px-3 py-2 text-slate-500">{c.bankasi || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 font-medium">{c.seriNo || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate">{c.aciklama || c.islem}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{fmt(c.tutar)} {c.currency}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DURUM_COLOR[c.durum] || 'bg-slate-100 text-slate-600'}`}>
                          {DURUM_LABEL[c.durum] || c.durum}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center relative">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === c.id ? null : c.id)}
                            className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded-lg"
                          >
                            {t('checks', 'actions')} ▾
                          </button>
                          {openDropdown === c.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[220px] overflow-hidden">
                                {ISLEMLER.filter(i => i.key !== c.durum).map(i => (
                                  <button key={i.key}
                                    onClick={() => handleDurumChange(c, i.key)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                                    {i.label}
                                  </button>
                                ))}
                                <div className="border-t border-slate-100" />
                                <button onClick={() => { setOpenDropdown(null); handleDelete(c.id); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                                  {t('checks', 'deleteCheck')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      {/* Confirm modal: TEDARIKCI_VERILDI → PORTFOY */}
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
                  <span className="font-semibold text-slate-700">{confirmModal.cek.borclu}</span> çeki tedarikçiye verilmiş durumda.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Portföye geri alındığında tedarikçi hesabından ilgili çek ödemesi <span className="font-semibold">otomatik olarak silinecek</span> ve bakiye güncellecek.
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  applyDurumChange(confirmModal.cek.id, confirmModal.durum, true);
                  setConfirmModal(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
              >
                Evet, Portföye Al
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
