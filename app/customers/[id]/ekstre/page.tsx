'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { formatDate, toDateInputValue } from '@/lib/time';
import { Loader2, FileSpreadsheet, FileDown, RefreshCw } from '@/app/components/icons';
import { buildCustomerRows } from '@/lib/statement-rows';
import { exportStatementCsv, exportStatementPdf, type StatementExportInput } from '@/lib/statement-export';
import StatementShareButton from '@/app/components/statement-share';
import FitText from '@/app/components/fit-text';
import BackLink from '@/app/components/back-link';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;

function defaultFrom() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}
function defaultTo() {
  return toDateInputValue();
}


export default function CustomerEkstrePage() {
  const params = useParams();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${params.id}/ekstre?from=${from}&to=${to}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }, [params?.id, from, to]);

  useEffect(() => { load(); }, []);

  // Cari döviz cinsi (USD/EUR carilerde TL yazılmasın)
  const cur: string = data?.customer?.currency || 'TRY';
  const { rows, totalBorc, totalAlacak, lastBalance } = buildCustomerRows(data);
  const exportInput = (): StatementExportInput => ({
    rows, totalBorc, totalAlacak, lastBalance,
    partyName: data?.customer?.name || 'ekstre', currency: cur, from, to,
    detailed: true, color: [37, 99, 235],
  });
  const handleExcel = () => { if (data) exportStatementCsv(exportInput()); };
  const handlePdf = async () => { if (data) await exportStatementPdf(exportInput()); };

  return (
    <AppShell>
      <div className="space-y-5 max-w-6xl">
        <BackLink href={`/customers/${params.id}`} prefix="Müşteri" label={data?.customer?.name ?? ''} />

        {/* Header */}
        <div>
          <p className="section-title">Hesap ekstresi</p>
          <h1 className="page-title mt-1.5">{data?.customer?.name || '…'}</h1>
        </div>

        {/* Date range + trigger */}
        <div className="bg-white rounded-xl shadow-card px-5 py-4 flex flex-wrap items-center gap-3 border border-ink-200/80">
          <span className="text-sm font-medium text-ink-600">Tarih Aralığı</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600" />
          <span className="text-ink-400">–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600" />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Raporu Hazırla
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
        ) : data?.error ? (
          <div className="text-center py-12 text-ink-400">Veri yüklenemedi</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 text-white bg-red-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Toplam Borç</p>
                <FitText className="text-2xl font-bold">{`${fmt(totalBorc)} ${cur}`}</FitText>
              </div>
              <div className="rounded-xl p-4 text-white bg-brand-600 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Toplam Alacak</p>
                <FitText className="text-2xl font-bold">{`${fmt(totalAlacak)} ${cur}`}</FitText>
              </div>
              <div className="rounded-xl p-4 text-white bg-emerald-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Bakiye</p>
                <FitText className="text-2xl font-bold">{`${fmt(lastBalance)} ${cur}`}</FitText>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={handlePdf}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <StatementShareButton accent="blue" party={{
                kind: 'customer', id: String(params.id), name: data?.customer?.name || '',
                phone: data?.customer?.phone, email: data?.customer?.email,
              }} />
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div className="bg-white rounded-xl shadow-card py-16 text-center text-ink-400 border border-ink-200/80">
                Bu tarih aralığında işlem bulunamadı
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="text-xs font-semibold text-ink-500 border-b bg-ink-50">
                        <th className="px-3 py-2.5 text-left">Tarih</th>
                        <th className="px-3 py-2.5 text-left">Vade</th>
                        <th className="px-3 py-2.5 text-left">Hareket</th>
                        <th className="px-3 py-2.5 text-left">Belge No</th>
                        <th className="px-3 py-2.5 text-left">Açıklama</th>
                        <th className="px-3 py-2.5 text-right">Miktar</th>
                        <th className="px-3 py-2.5 text-right">Fiyat</th>
                        <th className="px-3 py-2.5 text-right">Borç</th>
                        <th className="px-3 py-2.5 text-right">Alacak</th>
                        <th className="px-3 py-2.5 text-right">Bakiye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id}
                          className={r.isSubRow ? 'bg-amber-50 border-b border-amber-100' : r.hareket === 'İade' ? 'border-b border-red-100 bg-red-50/40' : 'border-b border-ink-100 hover:bg-ink-50/50'}>
                          <td className="px-3 py-2 text-ink-500 whitespace-nowrap">
                            {!r.isSubRow ? fmtDate(r.date) : ''}
                          </td>
                          <td className="px-3 py-2 text-ink-500 whitespace-nowrap">
                            {r.dueDate ? fmtDate(r.dueDate) : ''}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.hareket && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                r.hareket === 'Satış' ? 'bg-brand-100 text-brand-800' :
                                r.hareket === 'Tahsilat' ? 'bg-emerald-100 text-emerald-700' :
                                r.hareket === 'İade' ? 'bg-red-100 text-red-700' :
                                r.hareket === 'Borç Fişi' ? 'bg-amber-100 text-amber-700' :
                                r.hareket === 'Alacak Fişi' ? 'bg-brand-100 text-brand-800' :
                                r.hareket === 'Bakiye Düzeltme' ? 'bg-ink-100 text-ink-600' :
                                r.hareket === 'Çek' ? 'bg-brand-100 text-brand-800' :
                                'bg-amber-100 text-amber-700'
                              }`}>{r.hareket}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-ink-700">{r.belgeNo}</td>
                          <td className="px-3 py-2 text-ink-600 max-w-[180px]">
                            <span className="truncate block">
                              {r.productCode && <span className="text-xs font-mono text-ink-400 mr-1">[{r.productCode}]</span>}
                              {r.aciklama}
                            </span>
                            {r.extraInfo && <span className="text-xs text-brand-600 font-medium">({r.extraInfo})</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-ink-500">{r.miktar}</td>
                          <td className="px-3 py-2 text-right text-ink-500">
                            {r.fiyat != null ? fmt(r.fiyat) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600">
                            {r.borc > 0 ? fmt(r.borc) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                            {r.alacak > 0 ? fmt(r.alacak) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-ink-800 whitespace-nowrap">
                            {!r.isSubRow ? `${fmt(r.bakiye)} ${cur}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-ink-100 font-bold text-sm">
                        <td colSpan={7} className="px-3 py-3 text-ink-600">TOPLAM</td>
                        <td className="px-3 py-3 text-right text-red-600">{fmt(totalBorc)}</td>
                        <td className="px-3 py-3 text-right text-emerald-600">{fmt(totalAlacak)}</td>
                        <td className="px-3 py-3 text-right text-ink-800">{`${fmt(lastBalance)} ${cur}`}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
