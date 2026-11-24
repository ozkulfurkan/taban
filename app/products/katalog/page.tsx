'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import { ProductThumb } from '@/app/components/product-image';
import { ArrowLeft, BookOpen, CheckCircle, Circle, Loader2, Printer, Search } from '@/app/components/icons';
import { catalogHtml, formatPrice, type CatalogCompany, type CatalogProduct } from '@/lib/catalog-html';
import { matchesText } from '@/lib/search';

type Product = {
  id: string; name: string; code?: string | null; unit?: string | null; unitPrice?: number | null; currency?: string | null;
  imageUpdatedAt?: string | null; category?: { name: string } | null;
};

// Ürün kataloğu: müşteriye gönderilecek ürünler seçilir, fotoğraflı katalog yazdırma penceresinde açılır
// ("PDF olarak kaydet" ile PDF alınır). Mobil uygulamayla aynı şablon (lib/catalog-html).
export default function CatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('Ürün Kataloğu');
  const [customerName, setCustomerName] = useState('');
  const [showPrices, setShowPrices] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([]));
    fetch('/api/customers?minimal=true').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const rows = useMemo(() => (products ?? [])
    .filter(p => !search.trim() || matchesText(`${p.name} ${p.code ?? ''} ${p.category?.name ?? ''}`, search.trim())), [products, search]);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const allShown = rows.length > 0 && rows.every(r => chosen.has(r.id));
  const withoutPhoto = (products ?? []).filter(p => chosen.has(p.id) && !p.imageUpdatedAt).length;

  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const toggleAll = () => setSelected(s => (allShown
    ? s.filter(id => !rows.some(r => r.id === id))
    : [...s, ...rows.map(r => r.id).filter(id => !s.includes(id))]));

  const make = async () => {
    if (!selected.length) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/products/catalog-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productIds: selected }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Katalog hazırlanamadı');
      const company: CatalogCompany = data.company ?? { name: 'SoleCost', logoUrl: null, phone: null, address: null };
      const html = catalogHtml(company, data.products as CatalogProduct[], {
        title: title.trim() || 'Ürün Kataloğu', customerName: customerName.trim() || undefined, showPrices, date: new Date(),
      });
      // Gizli çerçevede yazdırma penceresi (sipariş föyüyle aynı yöntem)
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(frame);
      const doc = frame.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      await Promise.all(Array.from(doc.images).map(i => (i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 60_000);
    } catch (e: any) {
      setError(e?.message || 'Katalog hazırlanamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Link href="/products" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="w-4 h-4" /> Ürünler</Link>
            <h1 className="page-title mt-1 flex items-center gap-2"><BookOpen className="w-6 h-6 text-brand-700" /> Ürün Kataloğu</h1>
            <p className="text-sm text-ink-500 mt-1">Müşterinize göndereceğiniz ürünleri seçin; fotoğraflı katalog PDF olarak hazırlanır.</p>
          </div>
        </div>

        <div className="card p-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Katalog başlığı</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="input w-full" data-testid="catalog-title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Müşteri (isteğe bağlı)</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} list="catalog-customers" placeholder="Sayın …" className="input w-full" data-testid="catalog-customer" />
            <datalist id="catalog-customers">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700 select-none md:pb-2.5">
            <input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)} className="rounded border-ink-300 text-brand-700 focus:ring-brand-600" data-testid="catalog-prices" />
            Fiyatları göster
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad, kod veya kategori" className="input w-full pl-9" />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ink-500">{selected.length} ürün seçili</span>
            {rows.length ? <button onClick={toggleAll} className="font-semibold text-brand-700 hover:text-brand-800" data-testid="catalog-all">{allShown ? 'Seçimi kaldır' : 'Tümünü seç'}</button> : null}
          </div>
        </div>

        {products === null ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-700" /></div>
        ) : !rows.length ? (
          <div className="card p-10 text-center text-ink-500 text-sm">{search ? 'Aramaya uyan ürün yok.' : 'Henüz ürün yok.'}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(p => {
              const on = chosen.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  data-testid={`catalog-${p.id}`}
                  className={`text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${on ? 'border-brand-600 bg-brand-50' : 'border-ink-200 bg-white hover:border-ink-300'}`}
                >
                  <ProductThumb productId={p.id} imageUpdatedAt={p.imageUpdatedAt} className="w-14 h-14" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{p.name}</div>
                    <div className="text-xs text-ink-500 truncate">
                      {[p.code, p.category?.name, p.imageUpdatedAt ? null : 'fotoğraf yok'].filter(Boolean).join(' · ') || ' '}
                    </div>
                    {p.unitPrice ? <div className="text-xs text-ink-700 mt-0.5">{formatPrice(p.unitPrice, p.currency || 'TRY')} / {p.unit || 'çift'}</div> : null}
                  </div>
                  {on ? <CheckCircle className="w-6 h-6 text-brand-700 flex-shrink-0" weight="fill" /> : <Circle className="w-6 h-6 text-ink-300 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="sticky bottom-20 lg:bottom-4 z-30 card px-5 py-3 flex items-center justify-end gap-4 flex-wrap shadow-pop">
          {error ? <span className="text-sm text-red-600">{error}</span>
            : withoutPhoto ? <span className="text-xs text-ink-500">{withoutPhoto} ürünün fotoğrafı yok; katalogda kod ile gösterilir.</span> : null}
          <button onClick={make} disabled={!selected.length || busy} className="btn-primary" data-testid="catalog-pdf">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {selected.length ? `Katalog PDF hazırla (${selected.length} ürün)` : 'Katalog PDF hazırla'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
