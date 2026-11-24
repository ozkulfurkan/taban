'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalShell from '../../components/portal-shell';
import SizeTable from '../../components/size-table';
import { Loader2, Send } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';
import BackLink from '@/app/components/back-link';
import { cleanQuantity, isPairUnit, orderUnit, unitDecimals } from '@/lib/order-units';

const money = (n: number, cur: string) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

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
    requestedDeliveryDate: '',
    notes: '',
  });
  const [colorPartials, setColorPartials] = useState<ColorPartial[]>([{ name: tp('Renk'), color: '' }]);
  const [sizes, setSizes] = useState<Record<string, number>>(() => {
    try { return JSON.parse(searchParams.get('sizeDistribution') || '{}'); } catch { return {}; }
  });
  const [quantity, setQuantity] = useState('');
  const [freeCode, setFreeCode] = useState(() => !!searchParams.get('productCode') && !searchParams.get('productId'));
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

  const selected = catalog.find(c => c.id === form.productId);
  const unit = orderUnit(selected?.unit);
  const pair = isPairUnit(unit);
  const pairTotal = Object.values(sizes).reduce((s, v) => s + (Number(v) || 0), 0);
  const qty = pair ? pairTotal : cleanQuantity(Number(String(quantity).replace(',', '.')), unit) ?? 0;
  const price = selected?.price as { unitPrice: number; currency: string } | null | undefined;
  const estimate = price && qty > 0 ? price.unitPrice * qty : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!form.productId && !form.productCode.trim()) { setError(tp('Katalogdan bir ürün seçin.')); return; }
    if (!qty) { setError(pair ? tp('En az 1 adet girmelisiniz.') : tp('Geçerli bir miktar girin.')); return; }
    setLoading(true);
    try {
      const filledPartials = colorPartials.filter(p => p.color.trim());
      const res = await fetch('/api/portal/me/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          color: filledPartials[0]?.color || '',
          ...(pair ? { sizeDistribution: sizes } : { quantity: qty, sizeDistribution: {} }),
          colorPartials: filledPartials.length > 0 ? filledPartials : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || tp('Hata oluştu')); setLoading(false); return; }
      // Başarılıysa düğme kilitli kalır (çift gönderimi önler); sayfa değişir
      router.replace(`/portal/orders/${data.id}`);
    } catch { setError(tp('Hata oluştu')); setLoading(false); }
  };

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <BackLink variant="icon" href="/portal/orders" label={tp('Siparişlerim')} />
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
            {price && (
              <p className="text-sm text-ink-600" data-testid="new-order-price">
                {tp('Birim fiyat')}: <b>{money(price.unitPrice, price.currency)}</b> / {unit}
              </p>
            )}
            {freeCode || catalog.length === 0 ? (
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('Model Kodu')}</label>
                <input value={form.productCode} onChange={e => setForm(f => ({ ...f, productId: '', productCode: e.target.value }))} data-testid="free-code"
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" placeholder={tp('örn: SC-100')} />
              </div>
            ) : (
              <button type="button" onClick={() => { setFreeCode(true); setForm(f => ({ ...f, productId: '', productCode: '' })); }}
                className="text-xs text-brand-700 hover:underline" data-testid="free-code-link">
                {tp('Katalogda olmayan bir model mi?')}
              </button>
            )}
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1.5">{tp('İstenen Termin')}</label>
              <input type="date" value={form.requestedDeliveryDate} min={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, requestedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>

            {/* Renk Bilgileri */}
            <div className="border-t border-ink-100 pt-4">
              <label className="text-sm font-medium text-ink-600 mb-3 block">{tp('Renk Bilgileri')}</label>
              <div className="space-y-2">
                {colorPartials.map((partial, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-28 sm:w-32 flex-shrink-0 px-2.5 py-2 bg-ink-100 border border-ink-200 rounded-lg text-sm font-medium text-ink-700 truncate">
                      {partial.name}
                    </span>
                    <input
                      value={partial.color}
                      onChange={e => updatePartial(idx, e.target.value)}
                      placeholder={tp('örn: Siyah, Kahve...')}
                      className="flex-1 min-w-0 px-2.5 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Size distribution */}
          <div className="bg-white rounded-xl p-5 shadow-card space-y-3 border border-ink-200/80">
            {pair ? (
              <>
                <h2 className="font-semibold text-ink-700">{tp('Beden Dağılımı')}</h2>
                <SizeTable value={sizes} onChange={setSizes} />
              </>
            ) : (
              <>
                <h2 className="font-semibold text-ink-700">{tp('Miktar')} ({unit})</h2>
                <input value={quantity} onChange={e => setQuantity(e.target.value)} inputMode="decimal" data-testid="new-order-quantity"
                  placeholder={unitDecimals(unit) ? '0,000' : '0'}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
              </>
            )}
            {estimate != null && (
              <p className="text-sm text-ink-700 pt-2 border-t border-ink-100" data-testid="new-order-estimate">
                {tp('Tahmini tutar')}: <b>{money(estimate, price!.currency)}</b>
                <span className="block text-xs text-ink-400">{tp('Bilgi amaçlıdır; kesin tutar faturada yer alır.')}</span>
              </p>
            )}
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
