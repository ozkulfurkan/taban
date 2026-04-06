'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { formatDate, toDateInputValue } from '@/lib/time';
import { ArrowLeft, Loader2, FileSpreadsheet, FileDown, RefreshCw } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = formatDate;

function defaultFrom() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}
function defaultTo() {
  return toDateInputValue();
}

type Row = {
  id: string;
  date: string;
  hareket: string;
  belgeNo?: string;
  aciklama?: string;
  borc: number;
  alacak: number;
  bakiye: number;
};

export default function SupplierEkstrePage() {
  const params = useParams();
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${params.id}/ekstre?from=${from}&to=${to}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }, [params?.id, from, to]);

  useEffect(() => { load(); }, []);

  // Build merged row array
  const rows: Row[] = [];
  if (data && !data.error) {
    let balance = 0;
    const events: any[] = [
      ...(data.purchases || []).map((p: any) => ({ ...p, _type: 'purchase' })),
      ...(data.payments || []).map((p: any) => ({ ...p, _type: 'payment' })),
    ].sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (d !== 0) return d;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    events.forEach(ev => {
      if (ev._type === 'purchase') {
        balance += ev.total;
        rows.push({
          id: ev.id,
          date: ev.date,
          hareket: 'Alış',
          belgeNo: ev.invoiceNo,
          aciklama: ev.notes || '',
          borc: ev.total,
          alacak: 0,
          bakiye: balance,
        });
      } else {
        const method = ev.method || '';
        const notesStr = ev.notes || '';
        if (method === 'Borç Fişi') {
          balance += ev.amount;
          rows.push({
            id: ev.id,
            date: ev.date,
            hareket: 'Borç Fişi',
            aciklama: notesStr.replace(/^Vade:[^\s|]+\s*\|?\s*/, ''),
            borc: ev.amount,
            alacak: 0,
            bakiye: balance,
          });
        } else if (method === 'Alacak Fişi') {
          balance -= ev.amount;
          rows.push({
            id: ev.id,
            date: ev.date,
            hareket: 'Alacak Fişi',
            aciklama: notesStr.replace(/^Vade:[^\s|]+\s*\|?\s*/, ''),
            borc: 0,
            alacak: ev.amount,
            bakiye: balance,
          });
        } else if (method === 'Bakiye Düzeltme') {
          const isPositive = notesStr.startsWith('+');
          if (isPositive) {
            balance += ev.amount;
            rows.push({ id: ev.id, date: ev.date, hareket: 'Bakiye Düzeltme', aciklama: notesStr.replace(/^[+-]\s*\|?\s*/, ''), borc: ev.amount, alacak: 0, bakiye: balance });
          } else {
            balance -= ev.amount;
            rows.push({ id: ev.id, date: ev.date, hareket: 'Bakiye Düzeltme', aciklama: notesStr.replace(/^[+-]\s*\|?\s*/, ''), borc: 0, alacak: ev.amount, bakiye: balance });
          }
        } else {
          const isIade = notesStr.toLowerCase().includes('iade');
          balance -= ev.amount;
          rows.push({
            id: ev.id,
            date: ev.date,
            hareket: isIade ? 'İade' : 'Ödeme',
            aciklama: [method, notesStr && notesStr !== 'İade' ? notesStr : ''].filter(Boolean).join(' — '),
            borc: 0,
            alacak: ev.amount,
            bakiye: balance,
          });
        }
      }
    });
  }

  const totalBorc = rows.reduce((s, r) => s + r.borc, 0);
  const totalAlacak = rows.reduce((s, r) => s + r.alacak, 0);
  const lastBalance = rows.length > 0 ? rows[rows.length - 1].bakiye : 0;

  const handleExcel = () => {
    if (!data) return;
    const BOM = '\uFEFF';
    const header = 'Tarih;Hareket;Belge No;Açıklama;Borç;Alacak;Bakiye\n';
    const lines = rows.map(r =>
      [fmtDate(r.date), r.hareket, r.belgeNo || '', r.aciklama || '',
       r.borc > 0 ? fmt(r.borc) : '', r.alacak > 0 ? fmt(r.alacak) : '', fmt(r.bakiye)].join(';')
    ).join('\n');
    const blob = new Blob([BOM + header + lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.supplier?.name || 'ekstre'}_hesap_ekstresi.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdf = async () => {
    if (!data) return;
    const { default: jsPDF } = await import('jspdf');
    const tr = (s: string) => (s || '').replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297; const M = 10;
    let y = M;

    doc.setFillColor(13,148,136);
    doc.rect(0,0,W,18,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold');
    doc.text(tr(`${data.supplier?.name || ''} - HESAP EKSTRESI`), M, 11);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`${from} - ${to}`, W-M, 11, { align: 'right' });
    y = 26;

    doc.setTextColor(30,30,30); doc.setFontSize(8); doc.setFont('helvetica','bold');
    const cols = [22,20,28,70,28,28,28];
    const headers = ['Tarih','Hareket','Belge No','Aciklama','Borc','Alacak','Bakiye'];
    let x = M;
    doc.setFillColor(241,245,249); doc.rect(M, y-4, W-2*M, 7, 'F');
    headers.forEach((h, i) => { doc.text(h, x+1, y); x += cols[i]; });
    y += 5; doc.setFont('helvetica','normal');

    rows.forEach(r => {
      if (y > 190) { doc.addPage(); y = 15; }
      x = M;
      const vals = [fmtDate(r.date), tr(r.hareket), tr(r.belgeNo||''), tr((r.aciklama||'').substring(0,40)),
        r.borc > 0 ? fmt(r.borc) : '', r.alacak > 0 ? fmt(r.alacak) : '', fmt(r.bakiye)];
      vals.forEach((v, i) => { doc.text(String(v), x+1, y); x += cols[i]; });
      doc.setDrawColor(230,230,230); doc.line(M, y+2, W-M, y+2);
      y += 6;
    });

    y += 4;
    doc.setFont('helvetica','bold');
    doc.text(`Toplam Borc: ${fmt(totalBorc)}  |  Toplam Alacak: ${fmt(totalAlacak)}  |  Bakiye: ${fmt(lastBalance)}`, M, y);
    doc.save(`${tr(data.supplier?.name||'ekstre')}_hesap_ekstresi.pdf`);
  };

  return (
    <AppShell>
      <div className="space-y-5 max-w-6xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Header */}
        <div className="bg-teal-600 rounded-xl px-6 py-4">
          <h1 className="text-white font-bold text-lg uppercase tracking-wide">
            {data?.supplier?.name || '...'} HESAP EKSTRESİ
          </h1>
        </div>

        {/* Date range */}
        <div className="bg-white rounded-xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Tarih Aralığı</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-slate-400">–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Raporu Hazırla
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
        ) : data?.error ? (
          <div className="text-center py-12 text-slate-400">Veri yüklenemedi</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 text-white bg-red-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Toplam Borç</p>
                <p className="text-2xl font-bold">{fmt(totalBorc)}</p>
              </div>
              <div className="rounded-xl p-4 text-white bg-blue-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Toplam Alacak</p>
                <p className="text-2xl font-bold">{fmt(totalAlacak)}</p>
              </div>
              <div className="rounded-xl p-4 text-white bg-emerald-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Bakiye</p>
                <p className="text-2xl font-bold">{fmt(lastBalance)}</p>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button onClick={handleExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={handlePdf}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                <FileDown className="w-4 h-4" /> PDF
              </button>
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
                Bu tarih aralığında işlem bulunamadı
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                        <th className="px-3 py-2.5 text-left">Tarih</th>
                        <th className="px-3 py-2.5 text-left">Hareket</th>
                        <th className="px-3 py-2.5 text-left">Belge No</th>
                        <th className="px-3 py-2.5 text-left">Açıklama</th>
                        <th className="px-3 py-2.5 text-right">Borç</th>
                        <th className="px-3 py-2.5 text-right">Alacak</th>
                        <th className="px-3 py-2.5 text-right">Bakiye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              r.hareket === 'Alış' ? 'bg-indigo-100 text-indigo-700' :
                              r.hareket === 'Ödeme' ? 'bg-teal-100 text-teal-700' :
                              r.hareket === 'İade' ? 'bg-red-100 text-red-700' :
                              r.hareket === 'Borç Fişi' ? 'bg-orange-100 text-orange-700' :
                              r.hareket === 'Alacak Fişi' ? 'bg-purple-100 text-purple-700' :
                              r.hareket === 'Bakiye Düzeltme' ? 'bg-slate-100 text-slate-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>{r.hareket}</span>
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700">{r.belgeNo || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{r.aciklama}</td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600">
                            {r.borc > 0 ? fmt(r.borc) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-teal-600">
                            {r.alacak > 0 ? fmt(r.alacak) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap">
                            {fmt(r.bakiye)} TL
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-sm">
                        <td colSpan={4} className="px-3 py-3 text-slate-600">TOPLAM</td>
                        <td className="px-3 py-3 text-right text-red-600">{fmt(totalBorc)}</td>
                        <td className="px-3 py-3 text-right text-teal-600">{fmt(totalAlacak)}</td>
                        <td className="px-3 py-3 text-right text-slate-800">{fmt(lastBalance)}</td>
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
