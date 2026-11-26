'use client';

// Yeni sevk fişi: müşteri seçilir, açık siparişlerin kalan kalemleri gelir (miktar / kg düzenlenir),
// siparişsiz ürün eklenebilir; "Kaydet ve fişi yazdır" sevkiyatları kaydeder ve isteğe bağlı cari hesaba işler.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import { Loader2, Plus, Printer, Trash2, Truck, AlertTriangle } from '@/app/components/icons';
import { printDispatch } from '@/app/components/dispatch-print';
import { dispatchTotals } from '@/lib/dispatch-print-html';
import { formatQty, unitDecimals } from '@/lib/order-units';

type Price = { unitPrice: number; source: 'special' | 'list'; converted: boolean; originalCurrency: string } | null;
type Row = {
  key: string; on: boolean; productId: string | null; code: string; name: string; unit: string;
  qty: string; price: string; source: 'special' | 'list' | 'manual' | null; converted?: boolean;
  orderId?: string; orderNo?: string; orderLineIndex?: number; remaining?: number; invoiced?: boolean; status?: string;
};

const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// "1.250,5" ve "1250.5" ikisi de 1250,5: virgül varsa noktalar binlik ayıracıdır
const num = (s: string) => { const t = String(s).trim(); return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
const fmtPrice = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const SOURCE: Record<string, string> = { special: 'müşteri fiyatı', list: 'liste fiyatı', manual: 'elle' };

function NewDispatch() {
  const router = useRouter();
  const sp = useSearchParams();
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [customerId, setCustomerId] = useState(sp.get('customerId') ?? '');
  const [customer, setCustomer] = useState<{ name: string; currency: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [canPrice, setCanPrice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ carrier: '', vehiclePlate: '', driverName: '', notes: '', vatRate: '0', date: new Date().toISOString().slice(0, 10) });
  const [post, setPost] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);

  useEffect(() => {
    fetch('/api/customers?minimal=true').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/print-settings').then(r => r.json()).then(s => { if (typeof s?.postByDefault === 'boolean') setPost(s.postByDefault); }).catch(() => {});
    fetch('/api/company').then(r => r.json()).then(c => { if (c?.vatRate != null) setForm(f => ({ ...f, vatRate: String(c.vatRate) })); }).catch(() => {});
    // Siparişten gelindiyse müşteri siparişten bulunur
    const orderId = sp.get('orderId');
    if (orderId && !sp.get('customerId')) {
      fetch(`/api/orders/${orderId}`).then(r => r.json()).then(o => { if (o?.customerId) setCustomerId(o.customerId); }).catch(() => {});
    }
  }, [sp]);

  useEffect(() => {
    if (!customerId) { setRows([]); setCustomer(null); return; }
    setLoading(true); setError('');
    const only = sp.get('orderId');
    fetch(`/api/dispatches/open-lines?customerId=${customerId}`).then(r => r.json()).then(d => {
      setCustomer(d.customer ?? null); setCanPrice(!!d.canPrice);
      const list: Row[] = [];
      for (const o of d.orders ?? []) for (const l of o.lines) {
        const p: Price = l.price;
        list.push({
          key: `${o.orderId}:${l.orderLineIndex}`, on: only ? only === o.orderId : o.status === 'READY_FOR_SHIPMENT', productId: l.productId, code: l.code, name: l.name, unit: l.unit,
          qty: String(l.remaining).replace('.', ','), price: p ? fmtPrice(p.unitPrice) : '', source: p?.source ?? null, converted: p?.converted,
          orderId: o.orderId, orderNo: o.orderNo, orderLineIndex: l.orderLineIndex, remaining: l.remaining, invoiced: o.invoiced, status: o.status,
        });
      }
      setRows(list);
    }).catch(() => setError('Açık siparişler yüklenemedi')).finally(() => setLoading(false));
  }, [customerId, sp]);

  const loadProducts = () => { if (!products) fetch('/api/products?list=1').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); };
  const addProduct = async (p: any) => {
    setQ('');
    let price: Price = null;
    if (canPrice && customerId) {
      const d = await fetch(`/api/dispatches/open-lines?customerId=${customerId}&productIds=${p.id}`).then(r => r.json()).catch(() => null);
      price = d?.prices?.[p.id] ?? null;
    }
    setRows(r => [...r, {
      key: `p:${p.id}:${Date.now()}`, on: true, productId: p.id, code: p.code ?? '', name: p.name, unit: p.unit || 'çift',
      qty: '', price: price ? fmtPrice(price.unitPrice) : '', source: price?.source ?? null, converted: price?.converted,
    }]);
  };
  const set = (key: string, patch: Partial<Row>) => setRows(r => r.map(x => (x.key === key ? { ...x, ...patch } : x)));

  const chosen = rows.filter(r => r.on && num(r.qty) > 0);
  const totals = useMemo(() => dispatchTotals(
    chosen.filter(r => !r.invoiced).map(r => ({ name: r.name, qty: num(r.qty), unitPrice: r.price.trim() ? num(r.price) : null })),
    Number(form.vatRate) || 0,
  ), [chosen, form.vatRate]);
  const missing = canPrice && post && totals.missingPrice;
  const matches = (products ?? []).filter(p => q.trim().length >= 2 && `${p.name} ${p.code ?? ''}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))).slice(0, 8);

  const save = async () => {
    if (sending.current) return;
    setError('');
    if (!customerId) { setError('Müşteri seçin'); return; }
    if (!chosen.length) { setError('Sevk edilecek en az bir kalem seçin ve miktar girin'); return; }
    sending.current = true; setBusy(true);
    try {
      const r = await fetch('/api/dispatches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId, ...form, vatRate: Number(form.vatRate) || 0, post,
          lines: chosen.map(r => ({
            productId: r.productId, code: r.code, name: r.name, unit: r.unit, qty: num(r.qty),
            unitPrice: canPrice && r.price.trim() ? num(r.price) : undefined, orderId: r.orderId, orderLineIndex: r.orderLineIndex,
          })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Sevk fişi kaydedilemedi');
      await printDispatch(d.id).catch(() => {});
      const note = d.postError ? `&uyari=${encodeURIComponent(d.postError)}` : '';
      router.replace(`/sevkiyat/${d.id}?yeni=1${note}`);
    } catch (e: any) {
      setError(e?.message || 'Sevk fişi kaydedilemedi'); setBusy(false); sending.current = false;
    }
  };

  const input = 'w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none';
  const groups = Array.from(new Set(rows.map(r => r.orderNo ?? ''))) as string[];
  const statusOf = Object.fromEntries(rows.filter(r => r.orderNo).map(r => [r.orderNo, r.status]));

  return (
    <div className="max-w-5xl space-y-4 pb-28">
      <div className="space-y-1">
        <BackLink href="/sevkiyat" label="Sevkiyat" />
        <h1 className="page-title flex items-center gap-2"><Truck className="w-6 h-6 text-brand-700" /> Yeni Sevk Fişi</h1>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}

      <section className="bg-white rounded-xl border border-ink-200/80 shadow-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-customer">Müşteri *</label>
          <select id="sv-customer" value={customerId} onChange={e => setCustomerId(e.target.value)} className={`${input} bg-white`} data-testid="sv-customer">
            <option value="">Müşteri seçin…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-date">Sevk tarihi</label>
          <input id="sv-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={input} />
        </div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-carrier">Taşıyıcı / nakliyeci</label>
          <input id="sv-carrier" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} className={input} placeholder="ör. Aras Kargo, kendi aracımız" data-testid="sv-carrier" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-plate">Araç plakası</label>
          <input id="sv-plate" value={form.vehiclePlate} onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value.toLocaleUpperCase('tr') }))} className={input} placeholder="34 ABC 123" data-testid="sv-plate" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-driver">Şoför</label>
          <input id="sv-driver" value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} className={input} /></div>
      </section>

      {customerId && (
        <section className="bg-white rounded-xl border border-ink-200/80 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-100 flex flex-wrap items-center gap-3 justify-between">
            <h2 className="font-semibold text-ink-700">Sevk edilecek kalemler</h2>
            <div className="relative w-full sm:w-80">
              <input value={q} onFocus={loadProducts} onChange={e => setQ(e.target.value)} placeholder="Siparişte olmayan ürün ekle: ad veya kod" className={input} data-testid="sv-product-search" />
              {matches.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-white border border-ink-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                  {matches.map(p => (
                    <li key={p.id}><button type="button" onClick={() => void addProduct(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-ink-50">
                      <b className="text-brand-700">{p.code}</b> {p.name}</button></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-700" /></div>
            : rows.length === 0 ? <p className="px-4 py-8 text-sm text-ink-400 text-center">Bu müşterinin açık siparişi yok. Yukarıdan ürün ekleyerek siparişsiz sevk edebilirsiniz.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="sv-lines">
                  <thead className="bg-ink-50 text-xs text-ink-500"><tr>
                    <th className="px-3 py-2 w-8"><input type="checkbox" aria-label="Tümünü seç" checked={rows.length > 0 && rows.every(r => r.on)} onChange={e => setRows(rs => rs.map(r => ({ ...r, on: e.target.checked })))} data-testid="sv-all" /></th><th className="px-3 py-2 text-left">Ürün</th><th className="px-3 py-2 text-right">Kalan</th>
                    <th className="px-3 py-2 text-right w-32">Sevk miktarı</th>
                    {canPrice && <><th className="px-3 py-2 text-right w-32">Birim fiyat ({customer?.currency})</th><th className="px-3 py-2 text-right">Tutar</th></>}
                    <th className="px-3 py-2 w-8"></th>
                  </tr></thead>
                  {groups.map(g => (
                    <tbody key={g || 'free'} className="divide-y divide-ink-100">
                      <tr className="bg-ink-50/60"><td colSpan={canPrice ? 7 : 5} className="px-3 py-1.5 text-xs font-semibold text-ink-600">{g ? `Sipariş ${g}` : 'Siparişsiz kalemler'}{g && statusOf[g] === 'READY_FOR_SHIPMENT' && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">Sevke hazır</span>}</td></tr>
                      {rows.filter(r => (r.orderNo ?? '') === g).map(r => {
                        const qn = num(r.qty);
                        const t = r.price.trim() && qn > 0 ? qn * num(r.price) : null;
                        return (
                          <tr key={r.key} className={r.on ? '' : 'opacity-50'} data-testid="sv-row">
                            <td className="px-3 py-2"><input type="checkbox" checked={r.on} onChange={e => set(r.key, { on: e.target.checked })} aria-label={`${r.name} sevk et`} /></td>
                            <td className="px-3 py-2"><span className="font-semibold text-brand-700 mr-1">{r.code}</span>{r.name}
                              {r.invoiced && <span className="block text-[11px] text-amber-700">Bu sipariş zaten satışa çevrildi; hesaba tekrar işlenmez</span>}</td>
                            <td className="px-3 py-2 text-right text-ink-500 whitespace-nowrap">{r.remaining != null ? formatQty(r.remaining, r.unit) : '—'}</td>
                            <td className="px-3 py-2"><div className="flex items-center gap-1 justify-end">
                              <input value={r.qty} onChange={e => set(r.key, { qty: e.target.value, on: true })} inputMode={unitDecimals(r.unit) ? 'decimal' : 'numeric'}
                                className="w-24 px-2 py-1.5 border border-ink-200 rounded-lg text-right" data-testid="sv-qty" aria-label={`${r.name} miktar`} />
                              <span className="text-xs text-ink-500 w-8">{r.unit}</span></div></td>
                            {canPrice && <>
                              <td className="px-3 py-2"><input value={r.price} onChange={e => set(r.key, { price: e.target.value, source: 'manual' })} inputMode="decimal"
                                className={`w-28 px-2 py-1.5 border rounded-lg text-right ${!r.price.trim() && r.on && !r.invoiced ? 'border-red-400 bg-red-50' : 'border-ink-200'}`} placeholder="Fiyat girin" data-testid="sv-price" aria-label={`${r.name} fiyat`} />
                                {r.source && <span className="block text-[10px] text-ink-400 text-right">{SOURCE[r.source]}{r.converted ? ' · kurla çevrildi' : ''}</span>}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{t != null ? money(t) : '—'}</td>
                            </>}
                            <td className="px-3 py-2">{!r.orderId && <button type="button" onClick={() => setRows(x => x.filter(y => y.key !== r.key))} aria-label="Kaldır" className="p-1 text-ink-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          <div className="p-4 border-t border-ink-100 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2"><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-notes">Not</label>
              <input id="sv-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={input} /></div>
            {canPrice && <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="sv-vat">KDV oranı (%)</label>
              <input id="sv-vat" value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))} inputMode="decimal" className={input} /></div>}
          </div>
        </section>
      )}

      {customerId && (
        <div className="fixed bottom-0 inset-x-0 lg:left-64 z-30 bg-white/95 border-t border-ink-200 px-4 py-3">
          <div className="max-w-5xl flex flex-wrap items-center gap-4 justify-between">
            <div className="text-sm">
              <b>{chosen.length}</b> kalem
              {canPrice && <> · Ara toplam <b>{money(totals.subtotal)}</b> · KDV {money(totals.vat)} · <b>Genel toplam {money(totals.total)} {customer?.currency}</b></>}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink-700" title={canPrice ? '' : 'Fiyat yetkiniz yok: fiş taslak kaydedilir, yöneticiniz hesaba işler'}>
                <input type="checkbox" checked={post && canPrice} disabled={!canPrice} onChange={e => setPost(e.target.checked)} data-testid="sv-post" /> Cari hesaba işle
              </label>
              <button type="button" data-submit onClick={() => void save()} disabled={busy} data-testid="sv-save"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Kaydet ve fişi yazdır
              </button>
            </div>
          </div>
          {missing && <p className="max-w-5xl mt-1 text-xs text-red-600">Fiyatı boş kalem var: girin ya da fiş &quot;Fiyat bekliyor&quot; olarak hesaba işlenmeden kaydedilir.</p>}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <AppShell><Suspense fallback={null}><NewDispatch /></Suspense></AppShell>;
}
