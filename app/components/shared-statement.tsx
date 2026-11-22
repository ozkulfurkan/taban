'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, FileDown, RefreshCw, ChevronDown, ChevronRight, Phone, MapPin, LinkIcon } from '@/app/components/icons';
import { formatDate, toDateInputValue } from '@/lib/time';
import { buildCustomerRows, buildSupplierRows, type StatementRow } from '@/lib/statement-rows';
import { exportStatementPdf } from '@/lib/statement-export';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return toDateInputValue(d); };

type Data = {
  kind: 'customer' | 'supplier';
  party: { name: string; currency: string };
  company: { name: string; logoUrl: string | null; phone: string | null; address: string | null; taxId: string | null };
  [k: string]: any;
};

/**
 * Karşı tarafa gösterilen hesap ekstresi: link ile paylaşılan ekstre (/ekstre/[token]) ve
 * firma ağında bağlı firmanın sizin için tuttuğu ekstre (/firma-agi/[id]/ekstre) aynı görünümü kullanır.
 * endpoint ?from=export default function SharedStatementPage() {to= alır; 404, invalidOn404 ise "link geçersiz" ekranını, değilse yanıttaki hatayı gösterir.
 */
export function SharedStatement({ endpoint, embedded, invalidOn404, footer }: {
  endpoint: string; embedded?: boolean; invalidOn404?: boolean; footer?: (companyName: string) => string;
}) {
  const [from, setFrom] = useState(yearAgo());
  const [to, setTo] = useState(toDateInputValue());
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (f: string, t: string) => {
    setRefreshing(true);
    try {
      const res = await fetch(`${endpoint}?from=${f}&to=${t}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.status === 404 && invalidOn404) { setState('invalid'); return; }
      if (!res.ok) { setMessage(j.error || ''); setState('error'); return; }
      setData(j); setState('ready');
    } catch {
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, [endpoint, invalidOn404]);

  useEffect(() => { load(yearAgo(), toDateInputValue()); }, [load]);

  const result = useMemo(
    () => (data ? (data.kind === 'customer' ? buildCustomerRows(data) : buildSupplierRows(data)) : null),
    [data],
  );
  const items = useMemo(() => {
    const m: Record<string, StatementRow[]> = {};
    result?.rows.forEach(r => { if (r.isSubRow && r.parentId) (m[r.parentId] ||= []).push(r); });
    return m;
  }, [result]);

  if (state === 'loading') {
    return <Center embedded={embedded}><Loader2 className="w-8 h-8 animate-spin text-ink-400" /></Center>;
  }
  if (state === 'invalid') {
    return (
      <Center embedded={embedded}>
        <div className="max-w-md text-center bg-white rounded-2xl shadow-card border border-ink-200 px-6 py-10" data-testid="statement-invalid">
          <div className="mx-auto w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mb-4">
            <LinkIcon className="w-6 h-6 text-ink-400" />
          </div>
          <h1 className="page-title mb-2">Link geçersiz</h1>
          <p className="text-sm text-ink-600">Bu link geçersiz veya yenilenmiş. Lütfen gönderen firmadan yeni link isteyin.</p>
        </div>
      </Center>
    );
  }
  if (state === 'error' || !data || !result) {
    return (
      <Center embedded={embedded}>
        <div className="text-center text-sm text-ink-600 space-y-3">
          <p>{message || 'Ekstre yüklenemedi.'}</p>
          <button onClick={() => load(from, to)} className="px-4 py-2 rounded-lg bg-ink-800 text-white">Tekrar dene</button>
        </div>
      </Center>
    );
  }

  const cur = data.party.currency || 'TRY';
  const { rows, totalBorc, totalAlacak, lastBalance } = result;
  const mainRows = rows.filter(r => !r.isSubRow);
  const company = data.company;
  const detailed = data.kind === 'customer' || Object.keys(items).length > 0;
  // Bakiye kimin lehine: müşteri ekstresinde pozitif bakiye müşterinin borcudur
  const balanceNote = Math.abs(lastBalance) < 0.005 ? 'Hesap kapalı'
    : data.kind === 'customer'
      ? (lastBalance > 0 ? 'Firmaya borcunuz' : 'Firmadan alacağınız')
      : (lastBalance > 0 ? 'Firmadan alacağınız' : 'Firmaya borcunuz');

  const pdf = () => exportStatementPdf({
    ...result, partyName: data.party.name, currency: cur, from, to, detailed,
    color: [30, 41, 59], company,
  });

  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }));

  return (
    <div className={embedded ? "" : "min-h-screen bg-ink-100"}>
      <div className={embedded ? 'space-y-5' : 'max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-5'}>
        {/* Firma */}
        <header className="bg-white rounded-2xl shadow-card border border-ink-200 p-4 sm:p-6 flex items-center gap-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="h-12 sm:h-14 w-auto max-w-[120px] sm:max-w-[160px] object-contain shrink-0" />
          ) : (
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-ink-800 text-white text-xl font-bold flex items-center justify-center shrink-0">
              {company.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-ink-900" data-testid="statement-company">{company.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
              {company.phone && (
                <a href={`tel:${company.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-ink-900">
                  <Phone className="w-3.5 h-3.5" /> {company.phone}
                </a>
              )}
              {company.address && <span className="inline-flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {company.address}</span>}
              {company.taxId && <span>VKN: {company.taxId}</span>}
            </div>
          </div>
        </header>

        <div>
          <p className="text-sm text-ink-500">Sayın</p>
          <h1 className="page-title" data-testid="statement-party">{data.party.name}</h1>
          <p className="text-sm text-ink-600">Hesap Ekstresi · {cur}</p>
        </div>

        {/* Tarih aralığı */}
        <div className="bg-white rounded-2xl shadow-card border border-ink-200 px-4 py-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <span className="text-sm font-medium text-ink-600">Tarih aralığı</span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} aria-label="Başlangıç"
              className="w-full min-w-0 px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white" />
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} aria-label="Bitiş"
              className="w-full min-w-0 px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1">
            <button onClick={() => load(from, to)} disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-ink-800 hover:bg-ink-900 text-white disabled:opacity-60">
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Göster
            </button>
            <button onClick={pdf}
              className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-700 hover:bg-ink-50">
              <FileDown className="w-4 h-4" /> PDF İndir
            </button>
          </div>
        </div>

        {/* Özet */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Summary label="Toplam Borç" value={`${fmt(totalBorc)} ${cur}`} />
          <Summary label="Toplam Alacak" value={`${fmt(totalAlacak)} ${cur}`} />
          <Summary label="Bakiye" value={`${fmt(lastBalance)} ${cur}`} note={balanceNote} strong testId="statement-balance" />
        </div>

        {mainRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-ink-200 py-14 text-center text-ink-500">
            Bu tarih aralığında hareket yok
          </div>
        ) : (
          <>
            {/* Masaüstü tablo */}
            <div className="hidden md:block bg-white rounded-2xl shadow-card border border-ink-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-ink-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Tarih</th>
                    <th className="text-left px-4 py-3 font-semibold">Hareket</th>
                    <th className="text-left px-4 py-3 font-semibold">Belge / Açıklama</th>
                    <th className="text-right px-4 py-3 font-semibold">Borç</th>
                    <th className="text-right px-4 py-3 font-semibold">Alacak</th>
                    <th className="text-right px-4 py-3 font-semibold">Bakiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {mainRows.map(r => {
                    const sub = items[r.id];
                    const isOpen = !!open[r.id];
                    return (
                      <Fragment key={r.id}>
                        <tr className={sub ? 'cursor-pointer hover:bg-ink-50' : ''} onClick={sub ? () => toggle(r.id) : undefined}>
                          <td className="px-4 py-3 whitespace-nowrap text-ink-700">
                            {formatDate(r.date)}
                            {r.dueDate && <div className="text-xs text-ink-400">Vade {formatDate(r.dueDate)}</div>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-ink-800">{r.hareket}</td>
                          <td className="px-4 py-3 text-ink-600">
                            <div className="flex items-start gap-1">
                              {sub && (isOpen ? <ChevronDown className="w-4 h-4 mt-0.5 text-ink-400 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-ink-400 shrink-0" />)}
                              <div className="min-w-0">
                                {r.belgeNo && <span className="font-medium text-ink-800">{r.belgeNo}</span>}
                                {r.aciklama && <span className="block text-ink-500 break-words">{r.aciklama}</span>}
                                {r.extraInfo && <span className="block text-xs text-ink-400">{r.extraInfo}</span>}
                                {sub && !isOpen && <span className="block text-xs text-brand-700">{sub.length} kalem · detay için tıklayın</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{r.borc > 0 ? fmt(r.borc) : ''}</td>
                          <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{r.alacak > 0 ? fmt(r.alacak) : ''}</td>
                          <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold text-ink-900">{fmt(r.bakiye)}</td>
                        </tr>
                        {sub && isOpen && (
                          <tr className="bg-amber-50/60">
                            <td />
                            <td colSpan={5} className="px-4 pb-3 pt-1">
                              <ItemTable items={sub} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-ink-50 font-semibold text-ink-800">
                  <tr>
                    <td colSpan={3} className="px-4 py-3">Toplam</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totalBorc)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totalAlacak)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(lastBalance)} {cur}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Telefon: kartlar */}
            <div className="md:hidden space-y-3">
              {mainRows.map(r => {
                const sub = items[r.id];
                const isOpen = !!open[r.id];
                return (
                  <div key={r.id} className="bg-white rounded-xl shadow-card border border-ink-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-800">{r.hareket}{r.belgeNo ? ` · ${r.belgeNo}` : ''}</p>
                        <p className="text-xs text-ink-500">
                          {formatDate(r.date)}{r.dueDate ? ` · Vade ${formatDate(r.dueDate)}` : ''}
                        </p>
                      </div>
                      <p className={`text-right font-semibold tabular-nums whitespace-nowrap ${r.borc > 0 ? 'text-ink-900' : 'text-emerald-700'}`}>
                        {r.borc > 0 ? fmt(r.borc) : `−${fmt(r.alacak)}`} <span className="text-xs font-normal text-ink-500">{cur}</span>
                      </p>
                    </div>
                    {r.aciklama && <p className="mt-2 text-sm text-ink-600 break-words">{r.aciklama}</p>}
                    {r.extraInfo && <p className="text-xs text-ink-400">{r.extraInfo}</p>}
                    {sub && (
                      <button onClick={() => toggle(r.id)} className="mt-2 flex items-center gap-1 text-sm text-brand-700">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {sub.length} kalem
                      </button>
                    )}
                    {sub && isOpen && <div className="mt-2"><ItemTable items={sub} compact /></div>}
                    <p className="mt-3 pt-2 border-t border-ink-100 text-xs text-ink-500 flex justify-between">
                      <span>Bakiye</span><span className="font-semibold text-ink-800 tabular-nums">{fmt(r.bakiye)} {cur}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <footer className="text-center text-xs text-ink-400 py-4">
          {footer ? footer(company.name) : `Bu ekstre ${company.name} tarafından paylaşılmıştır. Sorularınız için firmayla iletişime geçebilirsiniz.`}
        </footer>
      </div>
    </div>
  );
}

function Center({ children, embedded }: { children: React.ReactNode; embedded?: boolean }) {
  return <div className={`${embedded ? "py-20" : "min-h-screen bg-ink-100"} flex items-center justify-center px-4`}>{children}</div>;
}

function Summary({ label, value, note, strong, testId }: { label: string; value: string; note?: string; strong?: boolean; testId?: string }) {
  return (
    <div className={`rounded-2xl p-4 border ${strong ? 'bg-ink-800 border-ink-800 text-white' : 'bg-white border-ink-200 text-ink-900'}`}>
      <p className={`text-xs font-medium ${strong ? 'text-ink-300' : 'text-ink-500'}`}>{label}</p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums break-words" data-testid={testId}>{value}</p>
      {note && <p className={`text-xs mt-1 ${strong ? 'text-ink-300' : 'text-ink-500'}`}>{note}</p>}
    </div>
  );
}

function ItemTable({ items, compact }: { items: StatementRow[]; compact?: boolean }) {
  return (
    <table className="w-full text-xs" data-testid="statement-items">
      <thead className="text-ink-500">
        <tr>
          <th className="text-left py-1 font-medium">Ürün</th>
          <th className="text-right py-1 font-medium">Miktar</th>
          {!compact && <th className="text-right py-1 font-medium">Birim Fiyat</th>}
          <th className="text-right py-1 font-medium">Tutar</th>
        </tr>
      </thead>
      <tbody className="text-ink-700">
        {items.map(it => {
          return (
            <tr key={it.id} className="border-t border-amber-100">
              <td className="py-1 pr-2">{it.productCode && <span className="text-ink-400">[{it.productCode}] </span>}{it.aciklama}</td>
              <td className="py-1 text-right tabular-nums whitespace-nowrap">{it.miktar}</td>
              {!compact && <td className="py-1 text-right tabular-nums whitespace-nowrap">{it.fiyat != null ? fmt(it.fiyat) : ''}</td>}
              <td className="py-1 text-right tabular-nums whitespace-nowrap">{it.tutar != null ? fmt(it.tutar) : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
