'use client';

import { useEffect, useMemo, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Loader2, Plus, Printer, X, Package, Trash2 } from '@/app/components/icons';
import { koliLabelHtml, planBoxes, sortSizes, type KoliLabel, type KoliMode } from '@/lib/koli';

export type KoliSource = {
  key: string; label: string;
  productId?: string | null; productCode?: string | null; productName: string; unit?: string | null; color?: string | null;
  /** ürüne tanımlı numaralar */
  sizes: string[];
  /** siparişten gelen adetler (numara → adet) */
  qty?: Record<string, number>;
};

const DEFAULT_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
const PRESETS: Array<[number, number]> = [[100, 50], [100, 75], [100, 100]];
type Row = { size: string; qty: string; boxes: string };

const rowsFor = (src: KoliSource): Row[] => {
  const fromQty = Object.keys(src.qty ?? {}).filter(s => (src.qty?.[s] ?? 0) > 0);
  const sizes = sortSizes(Array.from(new Set([...(src.sizes.length ? src.sizes : fromQty.length ? [] : DEFAULT_SIZES), ...fromQty])));
  return sizes.map(s => ({ size: s, qty: src.qty?.[s] ? String(src.qty[s]) : '', boxes: '1' }));
};

// Barkod SVG'si uygulamanın içinde üretilir (dış kaynak yüklenmez; termal yazıcıda internetsiz de çalışır)
function barcodeSvg(code: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, code, { format: 'CODE128', displayValue: false, margin: 0, width: 2, height: 60 });
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg.outerHTML;
}

// Koli etiketi: hangi numaradan kaç adet olduğu, müşteri ve koli sırası yazan, barkodlu etiket.
// Basılan her koli kaydedilir (barkod → içerik).
export function KoliLabelModal({ items, customer, order, defaultMode, defaultAddToStock = false, onClose, onPrinted }: {
  items: KoliSource[];
  customer?: { id: string; name: string } | null;
  order?: { id: string; orderNo: string } | null;
  defaultMode?: KoliMode;
  defaultAddToStock?: boolean;
  onClose: () => void;
  onPrinted?: (count: number) => void;
}) {
  const [itemKey, setItemKey] = useState(items[0]?.key ?? '');
  const src = items.find(i => i.key === itemKey) ?? items[0];
  const [mode, setMode] = useState<KoliMode>(defaultMode ?? (Object.keys(src?.qty ?? {}).length > 1 ? 'mixed' : 'single'));
  const [rows, setRows] = useState<Row[]>(() => rowsFor(src));
  const [newSize, setNewSize] = useState('');
  const [color, setColor] = useState(src?.color ?? '');
  const [boxCount, setBoxCount] = useState('1');
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState(customer?.id ?? '');
  const [customerName, setCustomerName] = useState(customer?.name ?? '');
  const [addToStock, setAddToStock] = useState(defaultAddToStock);
  const [size, setSize] = useState<[number, number]>([100, 75]);
  const [company, setCompany] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unit = src?.unit || 'çift';

  // Pencere açılınca bir kez: firma adı/logo, ayarlardaki etiket boyutu, müşteri listesi
  const hasCustomer = !!customer;
  useEffect(() => {
    fetch('/api/company').then(r => r.json()).then(d => { if (d && !d.error) setCompany({ name: d.name ?? '', logoUrl: d.logoUrl ?? null }); }).catch(() => {});
    fetch('/api/settings/barcode').then(r => r.json()).then(d => {
      if (d && !d.error && d.labelWidth && d.labelHeight) setSize([Number(d.labelWidth), Number(d.labelHeight)]);
    }).catch(() => {});
    if (!hasCustomer) fetch('/api/customers?minimal=true').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [hasCustomer]);

  const pickItem = (key: string) => {
    const next = items.find(i => i.key === key);
    if (!next) return;
    setItemKey(key); setRows(rowsFor(next)); setColor(next.color ?? '');
    setMode(Object.keys(next.qty ?? {}).length > 1 ? 'mixed' : mode);
  };
  const setRow = (i: number, k: keyof Row, v: string) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v.replace(/[^\d]/g, '') } : r)));
  const addSize = () => {
    const s = newSize.trim();
    if (!s || rows.some(r => r.size === s)) { setNewSize(''); return; }
    setRows(rs => { const all = [...rs, { size: s, qty: '', boxes: '1' }]; const order = sortSizes(all.map(r => r.size)); return all.sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size)); });
    setNewSize('');
  };

  const plan = useMemo(() => planBoxes(mode, rows.map(r => ({ size: r.size, qty: r.qty, boxes: r.boxes })), boxCount), [mode, rows, boxCount]);
  const summary = 'boxes' in plan
    ? { koli: plan.boxes.length, total: plan.boxes.reduce((a, b) => a + b.totalQuantity, 0) }
    : null;

  const print = async () => {
    if (!src || !('boxes' in plan)) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/koli', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, rows: rows.map(r => ({ size: r.size, qty: Number(r.qty) || 0, boxes: Number(r.boxes) || 1 })), boxCount: Number(boxCount) || 1,
          productId: src.productId ?? null, productCode: src.productCode ?? null, productName: src.productName, unit,
          color: color.trim() || null, customerId: customerId || null, customerName: customerName.trim() || null,
          orderId: order?.id ?? null, addToStock,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Etiket hazırlanamadı');
      const labels = data.labels as KoliLabel[];
      const svgs: Record<string, string> = {};
      for (const l of labels) svgs[l.barcode] = barcodeSvg(l.barcode);
      const html = koliLabelHtml(labels, {
        companyName: company.name, logoUrl: company.logoUrl, date: new Date().toLocaleDateString('tr-TR'),
        width: size[0], height: size[1], barcodeSvg: svgs,
      });
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(frame);
      const doc = frame.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      await Promise.all(Array.from(doc.images).map(i => (i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 60_000);
      onPrinted?.(labels.length);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Etiket hazırlanamadı');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-pop w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" data-testid="koli-modal">
        <div className="flex items-center justify-between px-5 py-3.5 bg-brand-700 text-white">
          <h2 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Koli Etiketi</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {items.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Ürün</label>
              <select value={itemKey} onChange={e => pickItem(e.target.value)} className={input} data-testid="koli-item">
                {items.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
              </select>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
              <div className="text-xs text-ink-500">Ürün</div>
              <div className="font-semibold text-ink-900">{src?.productCode ? `${src.productCode} · ` : ''}{src?.productName}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Renk (isteğe bağlı)</label>
              <input value={color} onChange={e => setColor(e.target.value)} className={input} placeholder="örn. Siyah" data-testid="koli-color" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Müşteri (isteğe bağlı)</label>
              {customer ? (
                <div className="px-3 py-2 rounded-lg bg-ink-50 text-sm font-medium">{customer.name}</div>
              ) : (
                <>
                  <input value={customerName} list="koli-customers" placeholder="Müşteri adı"
                    onChange={e => { setCustomerName(e.target.value); setCustomerId(customers.find(c => c.name === e.target.value)?.id ?? ''); }}
                    className={input} data-testid="koli-customer" />
                  <datalist id="koli-customers">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Etiket boyutu</label>
              <select value={size.join('x')} onChange={e => setSize(e.target.value.split('x').map(Number) as [number, number])} className={input}>
                {[...PRESETS, ...(PRESETS.some(p => p.join('x') === size.join('x')) ? [] : [size])].map(([w, h]) => (
                  <option key={`${w}x${h}`} value={`${w}x${h}`}>{w} × {h} mm</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex rounded-lg bg-ink-100 p-1 text-sm font-medium" role="tablist">
            {([['single', 'Tek numara koli', 'Her numara ayrı koli (ör. 37 No · 40 çift)'], ['mixed', 'Asorti koli', 'Numaralar tek kolide (ör. 36×1 37×2 38×2)']] as const).map(([m, t, d]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} data-testid={`koli-mode-${m}`}
                className={`flex-1 rounded-md px-3 py-2 text-left ${mode === m ? 'bg-white shadow-sm text-brand-800' : 'text-ink-600'}`}>
                <div>{t}</div><div className="text-[11px] font-normal text-ink-500">{d}</div>
              </button>
            ))}
          </div>

          <div className="border border-ink-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Numara</th>
                  <th className="px-3 py-2 text-left font-semibold">{mode === 'single' ? `Koli içi (${unit})` : `Adet (${unit})`}</th>
                  {mode === 'single' && <th className="px-3 py-2 text-left font-semibold">Koli sayısı</th>}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r, i) => (
                  <tr key={r.size}>
                    <td className="px-3 py-1.5 font-semibold text-ink-800">{r.size}</td>
                    <td className="px-3 py-1.5"><input inputMode="numeric" value={r.qty} onChange={e => setRow(i, 'qty', e.target.value)} placeholder="0"
                      className="w-24 px-2 py-1.5 border border-ink-200 rounded-md" data-testid={`koli-qty-${r.size}`} /></td>
                    {mode === 'single' && <td className="px-3 py-1.5"><input inputMode="numeric" value={r.boxes} onChange={e => setRow(i, 'boxes', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-ink-200 rounded-md" data-testid={`koli-boxes-${r.size}`} /></td>}
                    <td className="pr-2"><button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="p-1 text-ink-300 hover:text-red-600" aria-label={`${r.size} numarayı kaldır`}><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 p-2 bg-ink-50 border-t border-ink-100">
              <input value={newSize} onChange={e => setNewSize(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSize(); }} placeholder="Numara ekle (ör. 46)"
                className="flex-1 px-2 py-1.5 border border-ink-200 rounded-md text-sm" />
              <button onClick={addSize} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-ink-200 text-sm"><Plus className="w-4 h-4" /> Ekle</button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            {mode === 'mixed' ? (
              <label className="flex items-center gap-2 text-sm text-ink-700">Koli sayısı
                <input inputMode="numeric" value={boxCount} onChange={e => setBoxCount(e.target.value.replace(/[^\d]/g, ''))} className="w-20 px-2 py-1.5 border border-ink-200 rounded-md" data-testid="koli-boxcount" />
              </label>
            ) : <span />}
            {src?.productId ? (
              <label className="flex items-center gap-2 text-sm text-ink-700 select-none">
                <input type="checkbox" checked={addToStock} onChange={e => setAddToStock(e.target.checked)} className="rounded border-ink-300 text-brand-700" data-testid="koli-stock" />
                Toplamı stoğa ekle
              </label>
            ) : null}
          </div>

          <div className={`rounded-lg px-4 py-3 text-sm ${summary ? 'bg-brand-50 text-brand-900' : 'bg-ink-50 text-ink-500'}`} data-testid="koli-summary">
            {summary ? <><b>{summary.koli} koli etiketi</b> · toplam {summary.total.toLocaleString('tr-TR')} {unit}</> : 'error' in plan ? plan.error : ''}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-ink-100">
          <button onClick={onClose} className="flex-1 btn-secondary">Vazgeç</button>
          <button onClick={print} disabled={!summary || busy} className="flex-1 btn-primary" data-testid="koli-print">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Etiketleri yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
