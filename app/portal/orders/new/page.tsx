'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalShell from '../../components/portal-shell';
import SizeTable from '../../components/size-table';
import { Loader2, ArrowLeft, Send, Plus, Trash2 } from 'lucide-react';

type ColorPartial = { name: string; color: string };

export default function NewOrderPage() {
  const { status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();

  const [catalog, setCatalog] = useState<any[]>([]);
  const [form, setForm] = useState({
    productId: searchParams.get('productId') || '',
    productCode: searchParams.get('productCode') || '',
    material: searchParams.get('material') || '',
    requestedDeliveryDate: '',
    notes: '',
  });
  const [colorPartials, setColorPartials] = useState<ColorPartial[]>([{ name: 'Parti 1', color: '' }]);
  const [sizes, setSizes] = useState<Record<string, number>>(() => {
    try { return JSON.parse(searchParams.get('sizeDistribution') || '{}'); } catch { return {}; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/portal/me/catalog').then(r => r.json()).then(d => setCatalog(Array.isArray(d) ? d : []));
  }, [status, router]);

  const handleProductSelect = (id: string) => {
    const p = catalog.find(c => c.id === id);
    setForm(f => ({ ...f, productId: id, productCode: p?.code || '' }));
  };

  const addPartial = () => {
    setColorPartials(prev => [...prev, { name: `Parti ${prev.length + 1}`, color: '' }]);
  };

  const removePartial = (idx: number) => {
    setColorPartials(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePartial = (idx: number, field: keyof ColorPartial, value: string) => {
    setColorPartials(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const total = Object.values(sizes).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total === 0) { setError('En az 1 adet girmelisiniz.'); return; }
    setLoading(true);
    try {
      const filledPartials = colorPartials.filter(p => p.color.trim());
      const res = await fetch('/api/portal/me/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          color: filledPartials[0]?.color || '',
          sizeDistribution: sizes,
          colorPartials: filledPartials.length > 0 ? filledPartials : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Hata oluştu'); return; }
      router.push(`/portal/orders/${data.id}`);
    } finally { setLoading(false); }
  };

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Yeni Sipariş</h1>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Product */}
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Ürün Bilgileri</h2>
            {catalog.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Katalogdan Seç</label>
                <select value={form.productId} onChange={e => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">— Seçiniz —</option>
                  {catalog.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ''}{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Model Kodu</label>
                <input value={form.productCode} onChange={e => setForm(f => ({ ...f, productCode: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="örn: SC-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Malzeme</label>
                <input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="örn: Termo" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">İstenen Termin</label>
                <input type="date" value={form.requestedDeliveryDate} onChange={e => setForm(f => ({ ...f, requestedDeliveryDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            {/* Renk Partileri */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-600">Renk Partileri</label>
                <button type="button" onClick={addPartial}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                  <Plus className="w-3.5 h-3.5" /> Parti Ekle
                </button>
              </div>
              <div className="space-y-2">
                {colorPartials.map((partial, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={partial.name}
                      onChange={e => updatePartial(idx, 'name', e.target.value)}
                      placeholder="Parti adı"
                      className="w-28 flex-shrink-0 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      value={partial.color}
                      onChange={e => updatePartial(idx, 'color', e.target.value)}
                      placeholder="örn: Siyah, Kahve..."
                      className="flex-1 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {colorPartials.length > 1 && (
                      <button type="button" onClick={() => removePartial(idx)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Size distribution */}
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-700">Beden Dağılımı</h2>
            <SizeTable value={sizes} onChange={setSizes} />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Notlar</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Eklemek istediğiniz notlar..." />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Siparişi Gönder
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
