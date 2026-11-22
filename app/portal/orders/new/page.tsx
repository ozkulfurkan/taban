'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalShell from '../../components/portal-shell';
import SizeTable from '../../components/size-table';
import { Loader2, Send } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';
import BackLink from '@/app/components/back-link';

type ColorPartial = { name: string; color: string };

export default function NewOrderPage() {
  const { tp } = usePortalText();
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
  const [colorPartials, setColorPartials] = useState<ColorPartial[]>([{ name: tp('Renk'), color: '' }]);
  const [sizes, setSizes] = useState<Record<string, number>>(() => {
    try { return JSON.parse(searchParams.get('sizeDistribution') || '{}'); } catch { return {}; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/portal/me/catalog').then(r => r.json()).then(d => {
      const data = Array.isArray(d) ? d : [];
      setCatalog(data);
      // If a productId was pre-selected via URL param, init color partials from its parts
      const preId = searchParams.get('productId');
      if (preId) {
        const p = data.find((x: any) => x.id === preId);
        const parts = p?.parts ?? [];
        setColorPartials(parts.length > 0
          ? parts.map((pt: any) => ({ name: pt.name, color: '' }))
          : [{ name: tp('Renk'), color: '' }]);
      }
    });
  }, [status, router]);

  const handleProductSelect = (id: string) => {
    const p = catalog.find(c => c.id === id);
    setForm(f => ({ ...f, productId: id, productCode: p?.code || '' }));
    const parts = p?.parts ?? [];
    setColorPartials(parts.length > 0
      ? parts.map((pt: any) => ({ name: pt.name, color: '' }))
      : [{ name: tp('Renk'), color: '' }]);
  };

  const updatePartial = (idx: number, value: string) => {
    setColorPartials(prev => prev.map((p, i) => i === idx ? { ...p, color: value } : p));
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
      if (!res.ok) { setError(data.error || tp('Hata oluştu')); return; }
      router.replace(`/portal/orders/${data.id}`);
    } finally { setLoading(false); }
  };

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <BackLink variant="icon" href="/portal/orders" label="Siparişlerim" />
          <h1 className="page-title">{tp('Yeni Sipariş')}</h1>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Product */}
          <div className="bg-white rounded-xl p-5 shadow-card space-y-4 border border-ink-200/80">
            <h2 className="font-semibold text-ink-700">{tp('Ürün Bilgileri')}</h2>
            {catalog.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('Katalogdan Seç')}</label>
                <select value={form.productId} onChange={e => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none">
                  <option value="">{tp('— Seçiniz —')}</option>
                  {catalog.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ''}{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('Model Kodu')}</label>
                <input value={form.productCode} onChange={e => setForm(f => ({ ...f, productCode: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" placeholder={tp('örn: SC-100')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('Malzeme')}</label>
                <input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" placeholder={tp('örn: Termo')} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('İstenen Termin')}</label>
                <input type="date" value={form.requestedDeliveryDate} onChange={e => setForm(f => ({ ...f, requestedDeliveryDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
              </div>
            </div>

            {/* Renk Bilgileri */}
            <div className="border-t border-ink-100 pt-4">
              <label className="text-sm font-medium text-ink-600 mb-3 block">{tp('Renk Bilgileri')}</label>
              <div className="space-y-2">
                {colorPartials.map((partial, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-32 flex-shrink-0 px-2.5 py-2 bg-ink-100 border border-ink-200 rounded-lg text-sm font-medium text-ink-700 truncate">
                      {partial.name}
                    </span>
                    <input
                      value={partial.color}
                      onChange={e => updatePartial(idx, e.target.value)}
                      placeholder={tp('örn: Siyah, Kahve...')}
                      className="flex-1 px-2.5 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Size distribution */}
          <div className="bg-white rounded-xl p-5 shadow-card space-y-3 border border-ink-200/80">
            <h2 className="font-semibold text-ink-700">{tp('Beden Dağılımı')}</h2>
            <SizeTable value={sizes} onChange={setSizes} />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('Notlar')}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none resize-none" placeholder={tp('Eklemek istediğiniz notlar...')} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {tp('Siparişi Gönder')}
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
