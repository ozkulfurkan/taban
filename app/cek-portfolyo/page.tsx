'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/app/components/app-shell';
import { Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR');

const DURUM_LABEL: Record<string, string> = {
  PORTFOY: 'Portföyde',
  BANKAYA_VERILDI: 'Bankaya Verildi',
  TEDARIKCI_VERILDI: 'Tedarikçiye Verildi',
  ODENDI: 'Ödendi',
  KARSILIKS: 'Karşılıksız',
  IPTAL: 'İptal',
};

const DURUM_COLOR: Record<string, string> = {
  PORTFOY: 'bg-blue-100 text-blue-700',
  BANKAYA_VERILDI: 'bg-purple-100 text-purple-700',
  TEDARIKCI_VERILDI: 'bg-orange-100 text-orange-700',
  ODENDI: 'bg-green-100 text-green-700',
  KARSILIKS: 'bg-red-100 text-red-700',
  IPTAL: 'bg-slate-100 text-slate-600',
};

const TABS = [
  { key: '', label: 'Tüm Çekler' },
  { key: 'PORTFOY', label: 'Portföydekiler' },
  { key: 'TEDARIKCI_VERILDI', label: 'Tedarikçiye Verilenler' },
  { key: 'BANKAYA_VERILDI', label: 'Bankaya Verilenler' },
  { key: 'ODENDI', label: 'Ödenmişler' },
  { key: 'KARSILIKS', label: 'Karşılıksız Çıkanlar' },
  { key: 'IPTAL', label: 'İptaller' },
];

const ISLEMLER = [
  { key: 'PORTFOY', label: 'Portföye al' },
  { key: 'BANKAYA_VERILDI', label: 'Bankaya gönder' },
  { key: 'TEDARIKCI_VERILDI', label: 'Tedarikçiye ver' },
  { key: 'ODENDI', label: 'Tahsil et (Ödendi)' },
  { key: 'KARSILIKS', label: 'Karşılıksız olarak işaretle' },
  { key: 'IPTAL', label: 'İptal et' },
];

function calcAvgVade(cekler: any[]) {
  const total = cekler.reduce((s, c) => s + c.tutar, 0);
  if (!total) return null;
  const weightedMs = cekler.reduce((s, c) => s + c.tutar * new Date(c.vadesi).getTime(), 0);
  const avgMs = weightedMs / total;
  const avgDate = new Date(avgMs);
  const days = Math.round((avgDate.getTime() - Date.now()) / 86400000);
  return { date: avgDate, days };
}

export default function CekPortfoyuPage() {
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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

  const handleDurumChange = async (id: string, durum: string) => {
    setOpenDropdown(null);
    await fetch(`/api/cek/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durum }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu çeki silmek istediğinize emin misiniz?')) return;
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
          <h1 className="text-white font-bold text-lg uppercase tracking-wide">Çek Portföyü</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="flex border-b border-slate-100 min-w-max">
            {TABS.map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tab === t.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-orange-500 rounded-xl p-4 text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">Çek Sayısı</p>
            <p className="text-2xl font-bold">{data?.total ?? '—'}</p>
          </div>
          <div className="bg-blue-500 rounded-xl p-4 text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">Toplam Tutar</p>
            <p className="text-2xl font-bold">{fmt(totalTutar)} TL</p>
          </div>
          <div className="bg-emerald-500 rounded-xl p-4 text-white shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">Ortalama Vade</p>
            <p className="text-xl font-bold">
              {avgVade ? `${fmtDate(avgVade.date)} (${avgVade.days} gün)` : '—'}
            </p>
          </div>
        </div>

        {/* Search + Refresh */}
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İsim, vade, seri no ara..."
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">Kayıt bulunamadı</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                    <th className="px-3 py-2.5 text-left">Borçlu</th>
                    <th className="px-3 py-2.5 text-left">Alındığı Tarih</th>
                    <th className="px-3 py-2.5 text-left">Vadesi</th>
                    <th className="px-3 py-2.5 text-left">Bankası</th>
                    <th className="px-3 py-2.5 text-left">No</th>
                    <th className="px-3 py-2.5 text-left">Açıklama</th>
                    <th className="px-3 py-2.5 text-right">Tutar</th>
                    <th className="px-3 py-2.5 text-center">Durum</th>
                    <th className="px-3 py-2.5 text-center">İşlemler</th>
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
                            İşlemler ▾
                          </button>
                          {openDropdown === c.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[220px] overflow-hidden">
                                {ISLEMLER.filter(i => i.key !== c.durum).map(i => (
                                  <button key={i.key}
                                    onClick={() => handleDurumChange(c.id, i.key)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                                    {i.label}
                                  </button>
                                ))}
                                <div className="border-t border-slate-100" />
                                <button onClick={() => { setOpenDropdown(null); handleDelete(c.id); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                                  Çeki sil
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
                <span className="text-xs text-slate-500">Sayfa {page} / {totalPages} — {data.total} kayıt</span>
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
    </AppShell>
  );
}
