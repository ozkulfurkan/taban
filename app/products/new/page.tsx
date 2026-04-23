'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';

const CURRENCIES = ['USD', 'EUR', 'TRY'];

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromMaliyet = searchParams?.get('from') === 'maliyet';
  const { data: session } = useSession();
  const companyType = (session?.user as any)?.companyType ?? 'SOLE_MANUFACTURER';
  const isMaterial = companyType === 'MATERIAL_SUPPLIER';

  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', code: '', description: '',
    unit: isMaterial ? 'kg' : 'çift',
    unitPrice: '', currency: 'TRY', stock: '', notes: '',
    categoryId: '',
  });

  useEffect(() => {
    fetch('/api/product-categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }, []);

  // Sync unit default when session loads
  useEffect(() => {
    if (isMaterial) setForm(f => ({ ...f, unit: f.unit === 'çift' ? 'kg' : f.unit }));
  }, [isMaterial]);

  const UNITS = isMaterial ? ['kg', 'ton', 'lt', 'adet'] : ['çift', 'adet', 'kg', 'metre', 'paket'];

  const set = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          unitPrice: fromPriceInput(form.unitPrice),
          categoryId: form.categoryId || null,
        }),
      });
      const data = await res.json();
      if (data.id) router.push('/products/' + data.id + '?edit=true');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Yeni Ürün</h1>
        </div>

        {fromMaliyet && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            💡 Maliyet hesaplamak için önce ürün bilgilerini kayıt edin.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Ürün Adı *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder={isMaterial ? 'ör. 701 Krep Termogranül' : 'ör. Campus Taban'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ürün Kodu</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} placeholder={isMaterial ? 'ör. GRN-001' : 'ör. TBN-001'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kategori</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="">— Kategori Seç —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Birim</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Birim Fiyat</label>
              <input type="text" inputMode="decimal" value={form.unitPrice} onChange={e => set('unitPrice', normalizePriceInput(e.target.value))} onKeyDown={blockDot} placeholder="0,00" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Para Birimi</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mevcut Stok {isMaterial ? `(${form.unit})` : ''}</label>
              <input type="number" step="any" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Açıklama</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notlar</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
