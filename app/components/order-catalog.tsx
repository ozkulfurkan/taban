'use client';

import { useEffect, useState } from 'react';
import { Loader2, Package, Plus, ShoppingCart, Trash2, Send, ChevronUp } from 'lucide-react';
import { usePortalText } from '@/lib/i18n/portal';
import DecimalInput from '@/app/components/decimal-input';
import { cleanQuantity, formatQty, isPairUnit, orderUnit, unitDecimals } from '@/lib/order-units';
import SolesPanel from '@/app/components/soles-panel';

interface Product {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  sizes: string[];
  unit?: string | null;
  /** Alıcının bu ürünü daha önce alması (sipariş + fatura); sunucu sıralar, en son alınan üstte */
  purchased?: { count: number; lastAt: string } | null;
  /** Fotoğraf sürümü (yoksa fotoğraf yok): {catalogUrl}/{id}/image */
  imageUpdatedAt?: string | null;
}

interface CartItem {
  cartId: string;
  productId: string;
  productCode: string;
  productName: string;
  availableSizes: string[];
  color: string;
  sizeDistribution: Record<string, number>;
  totalQuantity: number;
  unit: string;
}

const ALL_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

// Katalog + sepet: portal müşterisi (/portal/catalog) ve bağlı SoleCost firması
// (/suppliers/:id/siparis) aynı ekranı kullanır; yalnızca veri adresleri değişir.
export default function OrderCatalog({ catalogUrl, orderUrl, onSubmitted, title, solesUrl, mapUrl }: {
  catalogUrl: string; orderUrl: string; onSubmitted: (order: { id: string }) => void; title?: string;
  /** Firma ağı: alıcının tabanları ve hammadde eşleştirme ("Tabanlarım" görünümü) */
  solesUrl?: string; mapUrl?: string;
}) {
  const [mode, setMode] = useState<'products' | 'soles'>('products');
  const { tp } = usePortalText();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [orderColor, setOrderColor] = useState('');
  const [orderSizes, setOrderSizes] = useState<Record<string, number>>({});
  const [orderQty, setOrderQty] = useState('');
  const [formError, setFormError] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(catalogUrl)
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : Array.isArray(d?.products) ? d.products : []))
      .finally(() => setLoading(false));
  }, [catalogUrl]);

  const getProductSizes = (product: Product) =>
    product.sizes && product.sizes.length > 0 ? product.sizes : ALL_SIZES;

  const openOrderForm = (product: Product) => {
    setActiveProductId(product.id);
    setOrderColor('');
    setOrderSizes({});
    setOrderQty('');
    setFormError('');
  };

  const closeOrderForm = () => {
    setActiveProductId(null);
    setFormError('');
  };

  const addToCart = (product: Product) => {
    const unit = orderUnit(product.unit);
    // Sepette tek birim: farklı birimli ürünler ayrı siparişte gönderilir
    if (cart.length && cart[0].unit !== unit) {
      setFormError(`Sepette ${cart[0].unit} birimli ürün var. ${unit} birimli ürünü ayrı bir siparişte gönderin.`);
      return;
    }
    if (!isPairUnit(unit)) {
      // DecimalInput değeri noktalı ondalıkla tutar ("1250.5")
      const qty = cleanQuantity(Number(orderQty), unit);
      if (qty === null) {
        setFormError(unitDecimals(unit) ? `Geçerli bir miktar girin (${unit}).` : `Tam sayı bir miktar girin (${unit}).`);
        return;
      }
      setCart(prev => [...prev, {
        cartId: Math.random().toString(36).slice(2),
        productId: product.id, productCode: product.code || '', productName: product.name,
        availableSizes: [], color: orderColor.trim(), sizeDistribution: {}, totalQuantity: qty, unit,
      }]);
      closeOrderForm();
      return;
    }
    if (!orderColor.trim()) { setFormError('Renk girmelisiniz.'); return; }
    const sizes = getProductSizes(product);
    const total = sizes.reduce((s, sz) => s + (Number(orderSizes[sz]) || 0), 0);
    if (total === 0) { setFormError('En az 1 adet girmelisiniz.'); return; }

    setCart(prev => [...prev, {
      cartId: Math.random().toString(36).slice(2),
      productId: product.id,
      productCode: product.code || '',
      productName: product.name,
      availableSizes: sizes,
      color: orderColor.trim(),
      sizeDistribution: { ...orderSizes },
      totalQuantity: total,
      unit,
    }]);
    closeOrderForm();
  };

  const removeFromCart = (cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId));

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const orderItems = cart.map(item => ({
        productId: item.productId || null,
        productCode: item.productCode || '',
        productName: item.productName || '',
        color: item.color,
        sizeDistribution: item.sizeDistribution,
        totalQuantity: item.totalQuantity,
        ...(isPairUnit(item.unit) ? {} : { quantity: item.totalQuantity }),
      }));
      const res = await fetch(orderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItems,
          requestedDeliveryDate: deliveryDate || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || tp('Bir hata oluştu.'));
        return;
      }
      onSubmitted(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">{title ?? tp('Ürün Kataloğu')}</h1>

        {/* Firma ağı: "Ürünler | Tabanlarım" (tabandan sepete ekleyince ilgili ürünün formu açılır) */}
        {solesUrl && mapUrl && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" data-testid="catalog-mode">
            {([['products', 'Ürünler'], ['soles', 'Tabanlarım']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium ${mode === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
            ))}
          </div>
        )}

        {solesUrl && mapUrl && mode === 'soles' ? (
          <SolesPanel solesUrl={solesUrl} mapUrl={mapUrl} products={products}
            onAdd={id => {
              const p = products.find(x => x.id === id);
              if (!p) return;
              setMode('products');
              openOrderForm(p);
              setTimeout(() => document.getElementById(`catalog-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            }} />
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{tp('Katalog henüz yüklenmedi.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(product => {
              const isActive = activeProductId === product.id;
              const sizes = getProductSizes(product);
              const formTotal = sizes.reduce((s, sz) => s + (Number(orderSizes[sz]) || 0), 0);
              const unit = orderUnit(product.unit);
              const pair = isPairUnit(unit);

              return (
                <div key={product.id} id={`catalog-card-${product.id}`} className={`bg-white rounded-xl shadow-sm flex flex-col overflow-hidden transition-all ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
                  {product.imageUpdatedAt && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${catalogUrl}/${product.id}/image?v=${encodeURIComponent(product.imageUpdatedAt)}`} alt={product.name}
                      loading="lazy" className="w-full aspect-[4/3] object-cover bg-slate-100" data-testid={`catalog-image-${product.id}`} />
                  )}
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {product.purchased && (
                          <p className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold" data-testid={`catalog-purchased-${product.id}`}>
                            {tp('Daha önce aldınız')} · {new Date(product.purchased.lastAt).toLocaleDateString('tr-TR')}{product.purchased.count > 1 ? ` · ${product.purchased.count}×` : ''}
                          </p>
                        )}
                        {product.code && <p className="text-xs font-semibold text-blue-600 mb-0.5">{product.code}</p>}
                        <p className="font-semibold text-slate-800 text-sm leading-tight">{product.name}</p>
                        {product.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>}
                      </div>
                    </div>

                    {pair ? (
                      <div>
                        <p className="text-xs text-slate-400 mb-1.5">{tp('Mevcut Numaralar')}</p>
                        <div className="flex flex-wrap gap-1">
                          {sizes.map(sz => (
                            <span key={sz} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">{sz}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">{tp('Birim')}: <span className="font-semibold text-slate-700" data-testid={`catalog-unit-${product.id}`}>{unit}</span></p>
                    )}

                    <button
                      onClick={() => isActive ? closeOrderForm() : openOrderForm(product)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isActive
                        ? <><ChevronUp className="w-4 h-4" /> {tp('Kapat')}</>
                        : <><Plus className="w-4 h-4" /> {tp('Sipariş Ver')}</>}
                    </button>
                  </div>

                  {isActive && (
                    <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{pair ? tp('Renk *') : tp('Renk / açıklama (isteğe bağlı)')}</label>
                        <input
                          value={orderColor}
                          onChange={e => { setOrderColor(e.target.value); setFormError(''); }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder={tp('örn: Siyah')}
                          autoFocus
                        />
                      </div>

                      {pair ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">{tp('Adet (Numaraya Göre)')}</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {sizes.map(sz => (
                            <div key={sz} className="flex flex-col items-center gap-0.5">
                              <span className="text-xs font-semibold text-slate-500">{sz}</span>
                              <DecimalInput
                               
                                min="0"
                                value={orderSizes[sz] || ''}
                                onChange={e => {
                                  setOrderSizes(prev => ({ ...prev, [sz]: parseInt(e.target.value) || 0 }));
                                  setFormError('');
                                }}
                                placeholder="0"
                                className="w-full text-center px-1 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          ))}
                        </div>
                        {formTotal > 0 && (
                          <p className="text-xs text-blue-600 font-medium mt-2 text-right">{tp('Toplam')}: {formTotal} {tp('çift')}</p>
                        )}
                      </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">{tp('Miktar')} ({unit}) *</label>
                          <div className="flex items-center gap-2">
                            <DecimalInput
                              value={orderQty}
                              onChange={e => { setOrderQty(e.target.value); setFormError(''); }}
                              integer={!unitDecimals(unit)}
                              placeholder={unitDecimals(unit) ? '0,000' : '0'}
                              data-testid={`catalog-qty-${product.id}`}
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-sm font-semibold text-slate-600">{unit}</span>
                          </div>
                        </div>
                      )}

                      {formError && <p className="text-xs text-red-600">{formError}</p>}

                      <button
                        onClick={() => addToCart(product)}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {tp('Sepete Ekle')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cart */}
        {cart.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-800">{tp('Sepet')}</h2>
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{cart.length} {tp('ürün')}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Model', tp('Renk'), tp('Beden Dağılımı'), tp('Toplam'), ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map(item => (
                    <tr key={item.cartId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {item.productCode && <span className="text-xs font-semibold text-blue-600 mr-1">{item.productCode}</span>}
                        <span className="font-medium text-slate-800">{item.productName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.color || '—'}</td>
                      <td className="px-4 py-3">
                        {!isPairUnit(item.unit) ? <span className="text-xs text-slate-500">—</span> : null}
                        <div className="flex flex-wrap gap-1">
                          {item.availableSizes
                            .filter(sz => (item.sizeDistribution[sz] || 0) > 0)
                            .map(sz => (
                              <span key={sz} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-medium">
                                <span className="text-blue-400">{sz}</span>
                                <span>×{item.sizeDistribution[sz]}</span>
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{formatQty(item.totalQuantity, item.unit)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeFromCart(item.cartId)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">{tp('Genel Toplam')}</td>
                    <td className="px-4 py-3 font-bold text-blue-700 whitespace-nowrap">
                      {formatQty(cart.reduce((s, i) => s + i.totalQuantity, 0), cart[0]?.unit)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{tp('İstenen Termin Tarihi')}</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{tp('Notlar')}</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={tp('Ek notlar...')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            {submitError && (
              <div className="px-5 pb-3">
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>
              </div>
            )}

            <div className="px-5 pb-5">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {tp('Siparişleri Gönder')} ({cart.length} {tp('ürün')})
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
