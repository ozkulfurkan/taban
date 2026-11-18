'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, AlertTriangle, Landmark, Truck, Wallet } from 'lucide-react';
import { formatDate, toDateInputValue } from '@/lib/time';
import { convertAmount, crossRate, type Rates } from '@/lib/fx';
import { totalsByCurrency, weightedAvgVade } from '@/lib/cek';
import { matchesText } from '@/lib/search';
import { fromPriceInput, toPriceInput, normalizePriceInput, blockDot } from '@/lib/price-input';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Cek = { id: string; borclu: string; tutar: number; currency: string; vadesi: string; seriNo?: string | null; bankasi?: string | null; bankAccountId?: string | null };

async function runBulk(body: Record<string, unknown>) {
  const res = await fetch('/api/cek/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? null : (data?.error || 'İşlem yapılamadı');
}

function Shell({ title, icon: Icon, color, onClose, children, footer }: {
  title: string; icon: any; color: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
        <div className={`${color} rounded-t-2xl px-5 py-4 flex items-center justify-between`}>
          <h2 className="text-white font-semibold flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">{children}</div>
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-2">{footer}</div>
      </div>
    </div>
  );
}

function Summary({ cekler }: { cekler: Cek[] }) {
  const totals = totalsByCurrency(cekler);
  const avg = weightedAvgVade(cekler);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <span><b>{cekler.length}</b> çek</span>
      {totals.map(t => <span key={t.currency} className="tabular-nums"><b>{fmt(t.total)}</b> {t.currency}</span>)}
      {avg && <span className="text-slate-500">Ort. vade {formatDate(avg.date)}</span>}
    </div>
  );
}

function Err({ text }: { text: string }) {
  return text ? (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {text}
    </p>
  ) : null;
}

const input = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white';
const btnCancel = 'px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50';

function useAccounts() {
  const [accounts, setAccounts] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : [])).catch(() => setAccounts([])); }, []);
  return accounts;
}

// ── Bankaya ver ─────────────────────────────────────────────────────────────
export function BankModal({ cekler, onClose, onDone }: { cekler: Cek[]; onClose: () => void; onDone: () => void }) {
  const accounts = useAccounts();
  const banks = (accounts ?? []).filter(a => a.type === 'Banka');
  const others = (accounts ?? []).filter(a => a.type !== 'Banka');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toDateInputValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!accountId && accounts?.length) setAccountId((banks[0] ?? accounts[0]).id); }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setError('');
    const e = await runBulk({ action: 'bank', ids: cekler.map(c => c.id), accountId, date });
    setSaving(false);
    if (e) setError(e); else { onDone(); onClose(); }
  };
  return (
    <Shell title="Bankaya Ver" icon={Landmark} color="bg-purple-600" onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnCancel}>Vazgeç</button>
        <button onClick={save} disabled={saving || !accountId}
          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Bankaya Ver
        </button>
      </>}>
      <Summary cekler={cekler} />
      {accounts && accounts.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Önce Hesaplarım sayfasından bir banka hesabı ekleyin.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="bank-acc">Banka hesabı *</label>
            <select id="bank-acc" value={accountId} onChange={e => setAccountId(e.target.value)} className={input}>
              {banks.length > 0 && <optgroup label="Banka hesapları">{banks.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</optgroup>}
              {others.length > 0 && <optgroup label="Diğer hesaplar">{others.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</optgroup>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="bank-date">Veriliş tarihi</label>
            <input id="bank-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">Para bu aşamada hesaba geçmez. Çek ödendiğinde <b>Tahsil Et</b> ile bu hesaba yansır.</p>
      <Err text={error} />
    </Shell>
  );
}

// ── Tahsil et ───────────────────────────────────────────────────────────────
export function CollectModal({ cekler, onClose, onDone }: { cekler: Cek[]; onClose: () => void; onDone: () => void }) {
  const accounts = useAccounts();
  const currencies = Array.from(new Set(cekler.map(c => c.currency)));
  const usable = (accounts ?? []).filter(a => currencies.length === 1 && a.currency === currencies[0]);
  const preferred = cekler.find(c => c.bankAccountId)?.bankAccountId ?? '';
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toDateInputValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (accountId || !usable.length) return;
    setAccountId(usable.some(a => a.id === preferred) ? preferred : usable[0].id);
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setError('');
    const e = await runBulk({ action: 'collect', ids: cekler.map(c => c.id), accountId, date });
    setSaving(false);
    if (e) setError(e); else { onDone(); onClose(); }
  };
  return (
    <Shell title="Tahsil Et" icon={Wallet} color="bg-teal-600" onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnCancel}>Vazgeç</button>
        <button onClick={save} disabled={saving || !accountId || currencies.length !== 1}
          className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Tahsil Et
        </button>
      </>}>
      <Summary cekler={cekler} />
      {currencies.length > 1 ? (
        <Err text="Seçilen çekler farklı dövizlerde. Her döviz için ayrı tahsil edin." />
      ) : accounts && usable.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{currencies[0]} dövizinde kasa / banka hesabı yok. Hesaplarım sayfasından ekleyin.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="col-acc">Kasa / banka hesabı *</label>
            <select id="col-acc" value={accountId} onChange={e => setAccountId(e.target.value)} className={input}>
              {usable.map(a => <option key={a.id} value={a.id}>{a.name}{a.id === preferred ? ' (çekin verildiği banka)' : ''} — {fmt(a.balance)} {a.currency}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="col-date">Tahsil tarihi</label>
            <input id="col-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
          </div>
        </div>
      )}
      <Err text={error} />
    </Shell>
  );
}

// ── Tedarikçiye ödeme ───────────────────────────────────────────────────────
export function SupplierPayModal({ cekler, onClose, onDone }: { cekler: Cek[]; onClose: () => void; onDone: () => void }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(toDateInputValue());
  const [note, setNote] = useState('');
  const [rates, setRates] = useState<Rates & { date?: string | null } | null>(null);
  const [ratesFailed, setRatesFailed] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : d?.suppliers ?? [])).catch(() => {});
    fetch('/api/exchange-rates').then(r => r.json()).then(d => {
      if (d?.usd || d?.eur) setRates(d); else setRatesFailed(true);
    }).catch(() => setRatesFailed(true));
  }, []);

  const supplier = suppliers.find(s => s.id === supplierId);
  const target = supplier?.currency ?? 'TRY';

  // Tedarikçi ya da kur değişince karşılıklar güncel kurla yeniden doldurulur (sonra elle değiştirilebilir)
  useEffect(() => {
    if (!supplier) return;
    const next: Record<string, string> = {};
    for (const c of cekler) {
      if (c.currency === target) continue;
      const v = rates ? convertAmount(c.tutar, c.currency, target, rates) : null;
      next[c.id] = v != null ? toPriceInput(v) : '';
    }
    setAmounts(next);
  }, [supplierId, rates]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const s = q.trim();
    return (s ? suppliers.filter(x => matchesText(x.name, s)) : suppliers).slice(0, 50);
  }, [q, suppliers]);

  const amountOf = (c: Cek) => (c.currency === target ? c.tutar : fromPriceInput(amounts[c.id] ?? ''));
  const total = cekler.reduce((s, c) => s + amountOf(c), 0);
  const missing = supplier ? cekler.filter(c => !(amountOf(c) > 0)) : [];

  const save = async () => {
    setSaving(true); setError('');
    const e = await runBulk({
      action: 'supplier', supplierId, date, note,
      ids: cekler.map(c => c.id),
      items: cekler.map(c => ({ id: c.id, amount: amountOf(c) })),
    });
    setSaving(false);
    if (e) setError(e); else { onDone(); onClose(); }
  };

  return (
    <Shell title="Tedarikçiye Ödeme Yap" icon={Truck} color="bg-orange-500" onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnCancel}>Vazgeç</button>
        <button onClick={save} disabled={saving || !supplier || missing.length > 0}
          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {supplier ? `${fmt(total)} ${target} Öde` : 'Ödemeyi Kaydet'}
        </button>
      </>}>
      <Summary cekler={cekler} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="sup-q">Tedarikçi *</label>
          {supplier ? (
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50">
              <span className="font-medium text-slate-800 truncate flex-1">{supplier.name}</span>
              <span className="text-xs font-semibold text-slate-500">{supplier.currency}</span>
              <button onClick={() => setSupplierId('')} className="text-xs text-orange-600 hover:underline">Değiştir</button>
            </div>
          ) : (
            <div className="relative">
              <input id="sup-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Tedarikçi ara..." className={input} autoFocus />
              <div className="mt-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100" role="listbox" aria-label="Tedarikçiler">
                {list.map(s => (
                  <button key={s.id} type="button" role="option" aria-selected={false} onClick={() => setSupplierId(s.id)}
                    className="w-full flex justify-between px-3 py-2 text-sm text-left hover:bg-orange-50">
                    <span className="truncate">{s.name}</span><span className="text-xs text-slate-400 ml-2">{s.currency}</span>
                  </button>
                ))}
                {list.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Sonuç yok</p>}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="sup-date">Veriliş tarihi</label>
          <input id="sup-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
        </div>
      </div>

      {supplier && (
        <>
          {rates?.date && cekler.some(c => c.currency !== target) && (
            <p className="text-xs text-slate-500">Karşılıklar TCMB {rates.date} satış kuruyla hesaplandı; gerekirse değiştirebilirsiniz.</p>
          )}
          {ratesFailed && cekler.some(c => c.currency !== target) && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Kur alınamadı; {target} karşılıklarını elle girin.</p>
          )}
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="px-3 py-2 text-left">Çek</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                  <th className="px-3 py-2 text-right">{target} karşılığı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cekler.map(c => {
                  const same = c.currency === target;
                  const r = rates && !same ? crossRate(c.currency, target, rates) : null;
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-700 truncate max-w-[180px]">{c.borclu}</p>
                        <p className="text-xs text-slate-400">{c.seriNo || '—'} · vade {formatDate(c.vadesi)}</p>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{fmt(c.tutar)} {c.currency}</td>
                      <td className="px-3 py-2 text-right">
                        {same ? (
                          <span className="tabular-nums">{fmt(c.tutar)}</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <input type="text" inputMode="decimal" aria-label={`${c.seriNo || c.borclu} ${target} karşılığı`}
                              value={amounts[c.id] ?? ''} onKeyDown={blockDot}
                              onChange={e => setAmounts(p => ({ ...p, [c.id]: normalizePriceInput(e.target.value) }))}
                              className={`w-32 px-2 py-1 border rounded text-right text-sm outline-none focus:ring-2 focus:ring-orange-400 ${amountOf(c) > 0 ? 'border-slate-200' : 'border-red-300 bg-red-50'}`} />
                            {r && <span className="text-[11px] text-slate-400">1 {c.currency} = {r.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} {target}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>Tedarikçiye ödenecek</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(total)} {target}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="sup-note">Not</label>
            <input id="sup-note" value={note} onChange={e => setNote(e.target.value)} className={input} />
          </div>
        </>
      )}
      <Err text={error} />
    </Shell>
  );
}
