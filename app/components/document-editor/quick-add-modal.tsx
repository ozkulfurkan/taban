'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { fromPriceInput, normalizePriceInput, blockDot } from '@/lib/price-input';
import { CURRENCIES } from '@/lib/money';
import { ACCENTS, type Accent, useDocText } from './shared';

// Kataloğa yeni ürün ya da hammadde ekler; eklenen kayıt doğrudan kaleme dönüşür.
export default function QuickAddModal({
  accent, allowMaterial, defaultType, currency, onCreated, onClose,
}: {
  accent: Accent;
  allowMaterial: boolean;
  defaultType: 'product' | 'material';
  currency: string;
  onCreated: (type: 'product' | 'material', record: any) => void;
  onClose: () => void;
}) {
  const tx = useDocText();
  const a = ACCENTS[accent];
  const [type, setType] = useState<'product' | 'material'>(allowMaterial ? defaultType : 'product');
  const [form, setForm] = useState({ name: '', code: '', categoryId: '', unit: 'çift', price: '', currency });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    fetch('/api/product-categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const set = (k: keyof typeof form, v: string) => { setForm(p => ({ ...p, [k]: v })); setDuplicate(false); setError(''); };

  const save = async (allowDuplicate = false) => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const price = fromPriceInput(form.price);
      const body = type === 'material'
        ? { name: form.name.trim(), pricePerKg: price, currency: form.currency, allowDuplicate }
        : { name: form.name.trim(), code: form.code.trim() || null, categoryId: form.categoryId || null, unit: form.unit, unitPrice: price, currency: form.currency, allowDuplicate };
      const res = await fetch(type === 'material' ? '/api/materials' : '/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.code === 'DUPLICATE_NAME') { setDuplicate(true); setError(data.error); return; }
      if (!res.ok || !data?.id) { setError(data?.error || 'Kaydedilemedi'); return; }
      onCreated(type, data);
    } finally { setSaving(false); }
  };

  const input = `w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 ${a.ring}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={e => { e.preventDefault(); save(duplicate); }} className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        <div className={`${a.head} rounded-t-2xl px-5 py-4 flex items-center justify-between`}>
          <h3 className="text-white font-semibold">{type === 'material' ? tx('quickAddTitleMaterial') : tx('quickAddTitleProduct')}</h3>
          <button type="button" onClick={onClose} aria-label={tx('close')} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {allowMaterial && (
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(['material', 'product'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-4 py-1.5 font-medium ${type === t ? `${a.solid} text-white` : 'text-slate-600 hover:bg-slate-50'}`}>
                  {t === 'material' ? tx('material') : tx('product')}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{tx('name')} *</label>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} className={input} />
          </div>
          {type === 'product' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{tx('code')}</label>
                <input value={form.code} onChange={e => set('code', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{tx('unit')}</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className={`${input} bg-white`}>
                  {['çift', 'adet', 'kg', 'metre', 'paket'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              {categories.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">{tx('category')}</label>
                  <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className={`${input} bg-white`}>
                    <option value="">—</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{type === 'material' ? tx('pricePerKg') : tx('unitPrice')}</label>
            <div className="flex gap-2">
              <input type="text" inputMode="decimal" value={form.price} placeholder="0,00"
                onChange={e => set('price', normalizePriceInput(e.target.value))} onKeyDown={blockDot}
                className={`${input} text-right`} />
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-24 px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{tx('cancel')}</button>
          <button type="submit" disabled={saving || !form.name.trim()}
            className={`flex-1 py-2 ${a.solid} ${a.solidHover} text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2`}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {duplicate ? 'Yine de ekle' : tx('saveAndAdd')}
          </button>
        </div>
      </form>
    </div>
  );
}
