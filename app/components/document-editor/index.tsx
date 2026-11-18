'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, AlertTriangle, X, ChevronDown, Info } from 'lucide-react';
import { matchesText } from '@/lib/search';
import { fmtQty } from '@/lib/stock-display';
import { fromPriceInput, toPriceInput } from '@/lib/price-input';
import { CURRENCIES } from '@/lib/money';
import { useLeaveGuard } from '@/lib/use-leave-guard';
import { type DocKind, type DocLine, docTotals, emptyLine, lineNet, lineProblem } from '@/lib/document-lines';
import StickySaveBar from '@/app/components/sticky-save-bar';
import BackLink from '@/app/components/back-link';
import LineModal from './line-modal';
import QuickAddModal from './quick-add-modal';
import StockConfirm, { stockImpact, type Deduction, type Shortage } from './stock-confirm';
import { ACCENTS, type Accent, useDocText, fmtMoney } from './shared';

export interface DocHeader {
  partyId: string;
  invoiceNo: string;
  date: string;
  time: string;
  dueDate: string;
  irsaliyeNo: string;
  sevkTarihi: string;
  currency: string;
  vatRate: string;
  notes: string;
  subcontractorId: string;
}

export type DocTotals = ReturnType<typeof docTotals>;
export type SubmitResult = { ok: true; redirect: string } | { ok: false; error: string };

const VAT_RATES = ['0', '1', '8', '10', '18', '20'];
const ACCENT_BY_KIND: Record<DocKind, Accent> = { sale: 'blue', return: 'red', purchase: 'indigo' };

function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

const asList = (d: any): any[] => (Array.isArray(d) ? d : d?.customers ?? d?.suppliers ?? d?.items ?? []);

// Satış, iade ve alış belgelerinin (yeni ve düzenleme) ortak ekranı.
export default function DocumentEditor({
  kind, mode, title, saveLabel, lockedPartyId, initialHeader, initialLines, prefillLines,
  infoRows = [], notice, minLines = 1, confirmStock = false, onSubmit,
}: {
  kind: DocKind;
  mode: 'new' | 'edit';
  title: string;
  saveLabel: string;
  lockedPartyId?: string;
  initialHeader?: Partial<DocHeader>;
  initialLines?: DocLine[];
  // Ürün listesi yüklenince eklenecek satırlar (sipariş/portal "Satışa Çevir")
  prefillLines?: (products: any[]) => DocLine[];
  infoRows?: { label: string; value: string }[];
  notice?: string;
  minLines?: number;
  confirmStock?: boolean;
  onSubmit: (header: DocHeader, lines: DocLine[], totals: DocTotals) => Promise<SubmitResult>;
}) {
  const router = useRouter();
  const tx = useDocText();
  const accent = ACCENT_BY_KIND[kind];
  const a = ACCENTS[accent];
  const isPurchase = kind === 'purchase';

  const [header, setHeader] = useState<DocHeader>(() => {
    const t = today();
    return {
      partyId: lockedPartyId ?? '', invoiceNo: '', date: t.date, time: t.time, dueDate: '', irsaliyeNo: '',
      sevkTarihi: kind === 'purchase' ? '' : t.date, currency: 'USD', vatRate: '0', notes: '', subcontractorId: '',
      ...initialHeader,
    };
  });
  const [lines, setLines] = useState<DocLine[]>(initialLines ?? []);
  const [touched, setTouched] = useState(false);
  const [parties, setParties] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [customerPrices, setCustomerPrices] = useState<Record<string, { unitPrice: number; currency: string }>>({});
  const [lineModal, setLineModal] = useState<{ line: DocLine; index: number | null } | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [stock, setStock] = useState<{ deductions: Deduction[]; shortages: Shortage[] } | null>(null);
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [errors, setErrors] = useState<{ party?: string; lines?: string }>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    try { return localStorage.getItem('doc_editor_advanced') !== 'false'; } catch { return true; }
  });
  const prefilled = useRef(false);
  const initialPartyId = initialHeader?.partyId;

  // Listeler
  useEffect(() => {
    const partyUrl = isPurchase ? '/api/suppliers' : '/api/customers';
    fetch(partyUrl).then(r => r.json()).then(async d => {
      const list = asList(d);
      // Liste sayfalı olabilir: kilitli ya da düzenlenen belgenin carisi listede yoksa ayrıca getir
      const needed = lockedPartyId || initialPartyId;
      if (needed && !list.some(p => p.id === needed)) {
        const one = await fetch(`${partyUrl}/${needed}`).then(r => r.json()).catch(() => null);
        if (one?.id) list.unshift({ id: one.id, name: one.name, currency: one.currency });
      }
      setParties(list);
    }).catch(() => {});
    fetch('/api/products').then(r => r.json()).then(d => setProducts(asList(d))).catch(() => {});
    fetch('/api/materials').then(r => r.json()).then(d => setMaterials(asList(d))).catch(() => {});
    if (isPurchase) fetch('/api/subcontractors').then(r => r.json()).then(d => setSubcontractors(asList(d))).catch(() => {});
  }, [isPurchase, lockedPartyId, initialPartyId]);

  useEffect(() => {
    if (prefilled.current || !prefillLines || products.length === 0) return;
    const extra = prefillLines(products);
    if (extra.length) { setLines(p => (p.length ? p : extra)); prefilled.current = true; }
  }, [products, prefillLines]);

  const party = parties.find(p => p.id === header.partyId);

  // Cari seçilince para birimi carininkine kilitlenir; satışta müşteriye özel fiyatlar gelir
  useEffect(() => {
    if (party?.currency && mode === 'new') setHeader(h => ({ ...h, currency: party.currency }));
    if (!isPurchase && header.partyId) {
      fetch(`/api/customers/${header.partyId}/prices`).then(r => r.json()).then((d: any[]) => {
        const map: Record<string, { unitPrice: number; currency: string }> = {};
        if (Array.isArray(d)) for (const p of d) map[p.productId] = { unitPrice: p.unitPrice, currency: p.currency };
        setCustomerPrices(map);
      }).catch(() => setCustomerPrices({}));
    }
  }, [header.partyId, party?.currency, isPurchase, mode]);

  const setField = (k: keyof DocHeader, v: string) => { setHeader(h => ({ ...h, [k]: v })); setTouched(true); };

  const vatRate = isPurchase ? 0 : parseFloat(header.vatRate) || 0;
  const totals = useMemo(() => docTotals(lines, vatRate), [lines, vatRate]);

  const { guard } = useLeaveGuard(!saving && (touched || (mode === 'new' && lines.length > 0)));

  // Arama: satışta ürünler, alışta hammadde + ürün
  const results = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return [];
    const hit = (x: any) => matchesText(x.name, q) || (x.code && matchesText(x.code, q)) || (x.barcode && String(x.barcode) === q);
    const list: Array<{ type: 'product' | 'material'; ref: any }> = [];
    if (isPurchase) for (const m of materials) if (hit(m)) list.push({ type: 'material', ref: m });
    for (const p of products) if (hit(p)) list.push({ type: 'product', ref: p });
    return list.slice(0, 30);
  }, [search, products, materials, isPurchase]);

  useEffect(() => { setHighlight(-1); }, [search]);

  const priceOf = (type: 'product' | 'material', ref: any) => {
    if (type === 'material') return ref.currency && ref.currency !== header.currency ? '' : toPriceInput(ref.pricePerKg ?? '');
    const special = !isPurchase ? customerPrices[ref.id] : undefined;
    if (special) return toPriceInput(special.unitPrice);
    return ref.currency && ref.currency !== header.currency ? '' : toPriceInput(ref.unitPrice ?? '');
  };

  const openFromCatalog = (type: 'product' | 'material', ref: any) => {
    setSearch('');
    setShowResults(false);
    setLineModal({
      index: null,
      line: emptyLine({
        itemType: type,
        productId: type === 'product' ? ref.id : undefined,
        materialId: type === 'material' ? ref.id : undefined,
        description: ref.name,
        unitPrice: priceOf(type, ref),
      }),
    });
  };

  const openManual = () => setLineModal({ index: null, line: emptyLine({ itemType: isPurchase ? 'material' : 'free' }) });

  const confirmLine = (line: DocLine) => {
    setLines(prev => (lineModal?.index == null ? [...prev, line] : prev.map((l, i) => (i === lineModal.index ? line : l))));
    setErrors(e => ({ ...e, lines: undefined }));
    setTouched(true);
    setLineModal(null);
  };

  const removeLine = (i: number) => { setLines(prev => prev.filter((_, idx) => idx !== i)); setTouched(true); };

  const submit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const r = await onSubmit(header, lines, totals);
      if (r.ok) { router.replace(r.redirect); return; } // düzenleme ekranı geçmişte kalmasın
      setStock(null);
      setSaveError(r.error);
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch {
      setSaveError('Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally { setSaving(false); }
  };

  const handleSave = () => {
    const errs: typeof errors = {};
    if (!header.partyId) errs.party = tx('requiredParty');
    if (lines.length < minLines) errs.lines = tx('requiredLines');
    const problem = lines.map((l, i) => lineProblem(kind, l, i)).find(Boolean);
    setErrors(errs);
    if (errs.party || errs.lines) return;
    if (problem) { setSaveError(problem); return; }
    if (confirmStock) {
      const impact = stockImpact(lines, products, materials);
      if (impact.deductions.length || impact.shortages.length) { setStock(impact); return; }
    }
    submit();
  };

  const partyLabel = isPurchase ? tx('supplier') : tx('customer');
  const input = `w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 ${a.ring}`;
  const label = 'block text-xs font-medium text-slate-500 mb-1';
  const showDiscountCol = lines.some(l => fromPriceInput(l.discount || '0') > 0);

  return (
    <div className="space-y-3">
      {saveError && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError('')} aria-label={tx('close')}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="space-y-1 min-w-0">
        {/* Geri: tarayıcı geçmişi yerine sabit olarak carinin sayfası (yoksa liste) */}
        <BackLink
          href={header.partyId ? `${isPurchase ? '/suppliers' : '/customers'}/${header.partyId}` : isPurchase ? '/purchases' : '/invoices'}
          prefix={header.partyId ? (isPurchase ? tx('supplier') : tx('customer')) : undefined}
          label={header.partyId ? party?.name ?? '…' : isPurchase ? tx('purchasesList') : tx('salesList')}
        />
        <h1 className="text-lg font-bold text-slate-800 truncate">{title}</h1>
      </div>

      {notice && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> {notice}
        </div>
      )}

      <div className="flex gap-4 items-start flex-col lg:flex-row">
        {/* SOL: belge bilgileri */}
        <section className="w-full lg:w-[340px] lg:flex-shrink-0 bg-white rounded-xl shadow-sm overflow-hidden" aria-label={title}>
          <div className={`${a.head} px-4 py-3`}>
            <p className="text-white font-semibold text-sm truncate">{party?.name || (isPurchase ? tx('noSupplier') : tx('noCustomer'))}</p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className={label} htmlFor="doc-party">{partyLabel} *</label>
              {lockedPartyId || mode === 'edit' ? (
                <div className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-700 font-medium">{party?.name ?? '…'}</div>
              ) : (
                <select id="doc-party" value={header.partyId}
                  onChange={e => { setField('partyId', e.target.value); setErrors(x => ({ ...x, party: undefined })); }}
                  className={`${input} bg-white ${errors.party ? 'border-red-400 ring-1 ring-red-400' : ''}`}>
                  <option value="">{isPurchase ? tx('selectSupplier') : tx('selectCustomer')}</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {errors.party && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.party}</p>}
            </div>
            <div>
              <label className={label} htmlFor="doc-no">{tx('docNo')}</label>
              <input id="doc-no" value={header.invoiceNo} onChange={e => setField('invoiceNo', e.target.value)} placeholder={tx('autoNo')} className={input} />
            </div>
            {infoRows.map(r => (
              <div key={r.label}>
                <span className={label}>{r.label}</span>
                <div className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-700 font-medium">{r.value}</div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor="doc-date">{tx('date')}</label>
                <input id="doc-date" type="date" value={header.date} onChange={e => setField('date', e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="doc-currency">{tx('currency')}</label>
                {party || mode === 'edit' ? (
                  <div className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm font-semibold text-slate-700" title={tx('partyCurrency')}>{header.currency}</div>
                ) : (
                  <select id="doc-currency" value={header.currency} onChange={e => setField('currency', e.target.value)} className={`${input} bg-white`}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>
            {isPurchase && subcontractors.length > 0 && (
              <div>
                <label className={label} htmlFor="doc-depot">{tx('depot')}</label>
                <select id="doc-depot" value={header.subcontractorId} onChange={e => setField('subcontractorId', e.target.value)} className={`${input} bg-white`}>
                  <option value="">{tx('mainDepot')}</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button type="button"
              onClick={() => { const n = !showAdvanced; setShowAdvanced(n); try { localStorage.setItem('doc_editor_advanced', String(n)); } catch {} }}
              className={`flex items-center gap-1 text-xs font-medium py-0.5 ${a.text}`} aria-expanded={showAdvanced}>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} /> {tx('advanced')}
            </button>
            {showAdvanced && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label} htmlFor="doc-time">{tx('time')}</label>
                    <input id="doc-time" type="time" value={header.time} onChange={e => setField('time', e.target.value)} className={input} />
                  </div>
                  {!isPurchase && (
                    <div>
                      <label className={label} htmlFor="doc-due">{tx('dueDate')}</label>
                      <input id="doc-due" type="date" value={header.dueDate} onChange={e => setField('dueDate', e.target.value)} className={input} />
                    </div>
                  )}
                </div>
                {!isPurchase && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={label} htmlFor="doc-waybill">{tx('waybillNo')}</label>
                      <input id="doc-waybill" value={header.irsaliyeNo} onChange={e => setField('irsaliyeNo', e.target.value)} className={input} />
                    </div>
                    <div>
                      <label className={label} htmlFor="doc-ship">{tx('shipDate')}</label>
                      <input id="doc-ship" type="date" value={header.sevkTarihi} onChange={e => setField('sevkTarihi', e.target.value)} className={input} />
                    </div>
                  </div>
                )}
                <div>
                  <label className={label} htmlFor="doc-notes">{tx('notes')}</label>
                  <textarea id="doc-notes" rows={3} value={header.notes} onChange={e => setField('notes', e.target.value)} className={`${input} resize-none`} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SAĞ: kalemler */}
        <section className="flex-1 min-w-0 w-full bg-white rounded-xl shadow-sm overflow-hidden" aria-label={tx('lines')}>
          <div className="bg-slate-700 px-4 py-3">
            <p className="text-white font-semibold text-sm uppercase tracking-wide">{tx('lines')}</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="relative">
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setShowResults(false); return; }
                  if (!results.length) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, results.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter') {
                    e.preventDefault();
                    const r = results[highlight >= 0 ? highlight : 0];
                    if (r) openFromCatalog(r.type, r.ref);
                  }
                }}
                placeholder={isPurchase ? tx('searchProductsMaterials') : tx('searchProducts')}
                aria-label={isPurchase ? tx('searchProductsMaterials') : tx('searchProducts')}
                className={`w-full px-3 py-2.5 border-2 border-slate-200 ${a.border} rounded-lg text-sm outline-none`}
              />
              {showResults && search.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto" role="listbox">
                  {search.trim().length < 2 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">{tx('typeMore')}</div>
                  ) : results.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">{tx('noResults')}</div>
                  ) : results.map((r, idx) => (
                    <button key={`${r.type}-${r.ref.id}`} type="button" role="option" aria-selected={idx === highlight}
                      onMouseDown={() => openFromCatalog(r.type, r.ref)} onMouseEnter={() => setHighlight(idx)}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left ${idx === highlight ? `${a.soft}` : 'hover:bg-slate-50'}`}>
                      <span className="min-w-0 truncate">
                        {isPurchase && (
                          <span className={`mr-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${r.type === 'material' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                            {r.type === 'material' ? tx('material') : tx('product')}
                          </span>
                        )}
                        <span className="font-medium text-slate-800">{r.ref.name}</span>
                        {r.ref.code && <span className="ml-1.5 text-xs text-slate-400">{r.ref.code}</span>}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                        {fmtQty(r.ref.stock ?? 0)} {r.type === 'material' ? 'kg' : r.ref.unit ?? ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <button type="button" onClick={openManual} className={`flex items-center gap-1.5 text-sm font-medium ${a.text}`}>
                <Plus className="w-4 h-4" /> {tx('manualLine')}
              </button>
              <button type="button" onClick={() => setQuickAdd(true)} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800">
                <Plus className="w-4 h-4" /> {isPurchase ? tx('quickAddItem') : tx('quickAddProduct')}
              </button>
            </div>

            {lines.length === 0 ? (
              <div className={`text-center py-10 border-2 border-dashed rounded-xl text-sm ${errors.lines ? 'border-red-300 bg-red-50 text-red-500' : 'border-slate-200 text-slate-400'}`}>
                {errors.lines ? <span className="inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{errors.lines}</span>
                  : isPurchase ? tx('emptyLinesPurchase') : tx('emptyLines')}
              </div>
            ) : (
              <>
                {/* Masaüstü: tablo */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 font-medium border-b">
                        <th className="text-left pb-2">{tx('item')}</th>
                        <th className="text-right pb-2 px-2 w-24">{tx('qty')}</th>
                        <th className="text-right pb-2 px-2 w-28">{tx('unitPrice')}</th>
                        {showDiscountCol && <th className="text-right pb-2 px-2 w-16">{tx('discount')}</th>}
                        <th className="text-right pb-2 w-32">{tx('lineTotal')}</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((l, i) => (
                        <tr key={l.key} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setLineModal({ index: i, line: l })}>
                          <td className="py-2 pr-2"><LineName l={l} kind={kind} products={products} tx={tx} /></td>
                          <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap tabular-nums">{fmtQty(fromPriceInput(l.quantity))}{l.itemType === 'material' ? ' kg' : ''}</td>
                          <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap tabular-nums">{fmtMoney(fromPriceInput(l.unitPrice))}</td>
                          {showDiscountCol && <td className="py-2 px-2 text-right text-slate-500">{fromPriceInput(l.discount) > 0 ? `%${l.discount}` : '—'}</td>}
                          <td className="py-2 text-right font-semibold text-slate-800 whitespace-nowrap tabular-nums">{fmtMoney(lineNet(l))}</td>
                          <td className="py-2 pl-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 justify-end">
                              <button type="button" onClick={() => setLineModal({ index: i, line: l })} aria-label={tx('edit')} title={tx('edit')} className="p-1.5 text-slate-400 hover:text-slate-700 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => removeLine(i)} aria-label={tx('remove')} title={tx('remove')} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Telefon: kartlar */}
                <ul className="sm:hidden space-y-2">
                  {lines.map((l, i) => (
                    <li key={l.key} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" className="min-w-0 text-left flex-1" onClick={() => setLineModal({ index: i, line: l })}>
                          <LineName l={l} kind={kind} products={products} tx={tx} />
                          <p className="text-xs text-slate-500 mt-1 tabular-nums">
                            {fmtQty(fromPriceInput(l.quantity))}{l.itemType === 'material' ? ' kg' : ''} × {fmtMoney(fromPriceInput(l.unitPrice))}
                            {fromPriceInput(l.discount) > 0 ? ` · %${l.discount}` : ''}
                          </p>
                        </button>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-slate-800 tabular-nums">{fmtMoney(lineNet(l))}</p>
                          <button type="button" onClick={() => removeLine(i)} aria-label={tx('remove')} className="mt-1 p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {(lines.length > 0 || !isPurchase) && (
              <div className="border-t pt-4 space-y-2">
                {!isPurchase && (
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-500" htmlFor="doc-vat">{tx('vatRate')}</label>
                    <select id="doc-vat" value={header.vatRate} onChange={e => setField('vatRate', e.target.value)}
                      className={`px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white w-24 outline-none focus:ring-2 ${a.ring}`}>
                      {Array.from(new Set([...VAT_RATES, String(parseFloat(header.vatRate) || 0)])).map(r => <option key={r} value={r}>%{r}</option>)}
                    </select>
                  </div>
                )}
                {!isPurchase && (
                  <div className="flex justify-between text-sm text-slate-600"><span>{tx('subtotal')}</span><span className="tabular-nums">{fmtMoney(totals.subtotal)} {header.currency}</span></div>
                )}
                {vatRate > 0 && (
                  <div className="flex justify-between text-sm text-slate-600"><span>{tx('vat')} (%{vatRate})</span><span className="tabular-nums">{fmtMoney(totals.vatAmount)} {header.currency}</span></div>
                )}
                <div className={`flex justify-between text-base font-bold text-slate-800 ${isPurchase ? '' : 'border-t pt-2'}`}>
                  <span>{tx('grandTotal')}</span><span className="tabular-nums">{fmtMoney(totals.total)} {header.currency}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <StickySaveBar
        summaryLabel={tx('grandTotal')}
        summaryValue={`${fmtMoney(totals.total)} ${header.currency}`}
        onSave={handleSave}
        saving={saving}
        tone={kind === 'return' ? 'danger' : kind === 'purchase' ? 'indigo' : 'primary'}
        saveLabel={saveLabel}
        savingLabel={tx('saving')}
      />
      {guard}

      {lineModal && (
        <LineModal
          kind={kind} accent={accent} initial={lineModal.line} isNew={lineModal.index == null}
          currency={header.currency} products={products} materials={materials} customerPrices={customerPrices}
          onConfirm={confirmLine} onClose={() => setLineModal(null)}
        />
      )}
      {quickAdd && (
        <QuickAddModal
          accent={accent} allowMaterial={isPurchase} defaultType={isPurchase ? 'material' : 'product'} currency={header.currency}
          onClose={() => setQuickAdd(false)}
          onCreated={(type, rec) => {
            if (type === 'material') setMaterials(p => [...p, rec]); else setProducts(p => [...p, rec]);
            setQuickAdd(false);
            openFromCatalog(type, rec);
          }}
        />
      )}
      {stock && (
        <StockConfirm deductions={stock.deductions} shortages={stock.shortages} saving={saving}
          onCancel={() => setStock(null)} onConfirm={submit} />
      )}
    </div>
  );
}

function LineName({ l, kind, products, tx }: { l: DocLine; kind: DocKind; products: any[]; tx: ReturnType<typeof useDocText> }) {
  const product = l.productId ? products.find(p => p.id === l.productId) : null;
  return (
    <div className="min-w-0">
      <p className="font-medium text-slate-800 truncate">
        {kind === 'purchase' && (
          <span className={`mr-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded align-middle ${l.itemType === 'material' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
            {l.itemType === 'material' ? tx('material') : tx('product')}
          </span>
        )}
        {l.description}
      </p>
      {kind === 'sale' && product && (
        (product.parts ?? []).length
          ? <p className="text-xs text-purple-600 truncate">{product.parts.map((p: any) => p.name).join(', ')}</p>
          : <p className="text-xs text-amber-600">⚠ {tx('noPartsShort')}</p>
      )}
      {l.notes && <p className="text-xs text-slate-400 truncate">{l.notes}</p>}
    </div>
  );
}
