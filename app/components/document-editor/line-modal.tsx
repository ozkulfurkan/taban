'use client';

import { isPairUnit } from '@/lib/order-units';
import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Check, Info } from '@/app/components/icons';
import { toPriceInput, fromPriceInput, normalizePriceInput, blockDot } from '@/lib/price-input';
import { stockTextClass, fmtQty } from '@/lib/stock-display';
import { type DocKind, type DocLine, type LineType, lineGross, lineNet, isPurchaseKind } from '@/lib/document-lines';
import { ACCENTS, type Accent, useDocText } from './shared';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tek kalem penceresi: satış, iade ve alışta aynı. Belge türüne göre
// hammadde seçimi (alış), parça hammaddesi (satış) ve iskonto (satış/iade) açılır.
export default function LineModal({
  kind, accent, initial, isNew, currency, products, materials, customerPrices, onConfirm, onClose,
}: {
  kind: DocKind;
  accent: Accent;
  initial: DocLine;
  isNew: boolean;
  currency: string;
  products: any[];
  materials: any[];
  customerPrices?: Record<string, { unitPrice: number; currency: string }>;
  onConfirm: (line: DocLine) => void;
  onClose: () => void;
}) {
  const tx = useDocText();
  const a = ACCENTS[accent];
  const isPurchase = isPurchaseKind(kind);
  const [line, setLine] = useState<DocLine>({ ...initial });
  const [showDiscount, setShowDiscount] = useState(() => fromPriceInput(initial.discount || '0') > 0);
  const [partMaterials, setPartMaterials] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const pv of initial.partVariantsData ?? []) map[pv.partId] = pv.materialId;
    return map;
  });
  const set = (field: keyof DocLine, value: string) => setLine(p => ({ ...p, [field]: value }));

  const product = line.itemType === 'product' ? products.find(p => p.id === line.productId) : null;
  const material = line.itemType === 'material' ? materials.find(m => m.id === line.materialId) : null;
  const parts: any[] = kind === 'sale' && product ? product.parts ?? [] : [];

  // Ürünün parçaları için varsayılan hammaddeler (kayıtlı seçim yoksa)
  useEffect(() => {
    if (parts.length && Object.keys(partMaterials).length === 0) {
      const d: Record<string, string> = {};
      for (const part of parts) if (part.materialId) d[part.id] = part.materialId;
      setPartMaterials(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const priceFor = (type: LineType, ref: any): string => {
    if (type === 'material') return ref.currency === currency || !ref.currency ? toPriceInput(ref.pricePerKg ?? '') : '';
    const special = !isPurchase ? customerPrices?.[ref.id] : undefined;
    if (special) return toPriceInput(special.unitPrice);
    return ref.currency === currency ? toPriceInput(ref.unitPrice ?? '') : '';
  };

  const choose = (type: LineType, id: string) => {
    if (!id) {
      setLine(p => ({ ...p, itemType: isPurchase ? p.itemType : 'free', productId: undefined, materialId: undefined }));
      setPartMaterials({});
      return;
    }
    const ref = (type === 'material' ? materials : products).find(x => x.id === id);
    if (!ref) return;
    setPartMaterials({});
    setLine(p => ({
      ...p,
      itemType: type,
      productId: type === 'product' ? ref.id : undefined,
      materialId: type === 'material' ? ref.id : undefined,
      description: ref.name,
      unitPrice: priceFor(type, ref) || p.unitPrice,
    }));
  };

  const catalogType: LineType = isPurchase ? (line.itemType === 'product' ? 'product' : 'material') : 'product';
  const catalog = catalogType === 'material' ? materials : products;
  const selectedId = catalogType === 'material' ? line.materialId ?? '' : line.productId ?? '';

  const gross = lineGross(line);
  const net = lineNet({ ...line, discount: showDiscount ? line.discount : '0' });
  const discountAmount = gross - net;

  const canConfirm = isPurchase
    ? !!(line.productId || line.materialId) && fromPriceInput(line.quantity) > 0
    : !!line.description.trim() && fromPriceInput(line.quantity) > 0;

  const confirm = () => {
    if (!canConfirm) return;
    const pvd = Object.entries(partMaterials).filter(([, m]) => m).map(([partId, materialId]) => ({ partId, materialId }));
    onConfirm({
      ...line,
      discount: showDiscount ? line.discount || '0' : '0',
      partVariantsData: parts.length && pvd.length ? pvd : undefined,
    });
  };

  const stockInfo = useMemo(() => {
    if (product && parts.length === 0) return { value: product.stock, unit: product.unit ?? '' };
    if (material) return { value: material.stock, unit: 'kg' };
    return null;
  }, [product, material, parts.length]);

  const qtyLabel = line.itemType === 'material' ? tx('qtyKg') : tx('qty');
  const priceLabel = line.itemType === 'material' ? tx('pricePerKg') : tx('unitPrice');
  const input = `w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 ${a.ring}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={e => { e.preventDefault(); confirm(); }}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] flex flex-col border border-ink-200/80"
      >
        <div className={`${a.head} rounded-t-2xl px-5 py-4 flex items-center justify-between`}>
          <h3 className="text-white font-semibold text-base truncate">{line.description || (isNew ? tx('newLine') : tx('editLine'))}</h3>
          <button type="button" onClick={onClose} aria-label={tx('close')} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {isPurchase && (
            <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm" role="tablist">
              {(['material', 'product'] as const).map(type => (
                <button key={type} type="button" role="tab" aria-selected={catalogType === type}
                  onClick={() => { setLine(p => ({ ...p, itemType: type, productId: undefined, materialId: undefined, description: '' })); }}
                  className={`px-4 py-1.5 font-medium ${catalogType === type ? `${a.solid} text-white` : 'text-ink-600 hover:bg-ink-50'}`}>
                  {type === 'material' ? tx('material') : tx('product')}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">
              {catalogType === 'material' ? tx('chooseMaterial') : tx('chooseProduct')}
            </label>
            <select value={selectedId} onChange={e => choose(catalogType, e.target.value)} className={`${input} bg-white`}>
              <option value="">{isPurchase ? tx('selectPlaceholder') : tx('manualEntry')}</option>
              {catalog.map((x: any) => (
                <option key={x.id} value={x.id}>{x.code ? `[${x.code}] ${x.name}` : x.name}</option>
              ))}
            </select>
          </div>

          {!isPurchase && line.itemType !== 'product' && (
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">{tx('description')}</label>
              <input value={line.description} onChange={e => set('description', e.target.value)} placeholder={tx('descriptionPlaceholder')} className={input} autoFocus />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">{qtyLabel}</label>
              <input type="text" inputMode="decimal" value={line.quantity}
                onChange={e => set('quantity', normalizePriceInput(e.target.value))} onKeyDown={blockDot}
                className={`${input} text-right`} />
              {stockInfo && (
                <p className={`text-xs mt-1 font-medium ${stockTextClass(stockInfo.value, 'text-emerald-600')}`}>
                  {tx('stock')}: {fmtQty(stockInfo.value)} {stockInfo.unit}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">{priceLabel}</label>
              <div className="flex">
                <input type="text" inputMode="decimal" value={line.unitPrice}
                  onChange={e => set('unitPrice', normalizePriceInput(e.target.value))} onKeyDown={blockDot}
                  className={`flex-1 min-w-0 px-3 py-2 border border-ink-200 rounded-l-lg text-sm text-right outline-none focus:ring-2 ${a.ring}`} />
                <span className="px-2 py-2 bg-ink-100 border border-l-0 border-ink-200 rounded-r-lg text-xs font-semibold text-ink-600 flex items-center">{currency}</span>
              </div>
              {product && !isPurchase && customerPrices?.[product.id] && (
                <p className="text-xs text-emerald-600 mt-1">✓ {tx('specialPrice')}: {fmt(customerPrices[product.id].unitPrice)} {customerPrices[product.id].currency}</p>
              )}
              {(product || material) && !(product && customerPrices?.[product.id]) && (product ?? material).currency && (product ?? material).currency !== currency && (
                <p className="text-xs text-amber-600 mt-1">⚠ {tx('catalogPrice')}: {fmt(product ? product.unitPrice : material.pricePerKg)} {(product ?? material).currency}</p>
              )}
            </div>
          </div>

          {parts.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink-600">{tx('partMaterials')}</label>
              {parts.map((part: any) => {
                const matId = partMaterials[part.id] ?? '';
                const mat = materials.find(m => m.id === matId);
                const stock = mat?.stock ?? part.material?.stock ?? null;
                return (
                  <div key={part.id} className="flex items-center gap-2">
                    <span className="w-24 flex-shrink-0 text-xs font-medium text-ink-600 bg-ink-100 px-2 py-1.5 rounded-lg text-center truncate">{part.name}</span>
                    <select value={matId} onChange={e => setPartMaterials(p => ({ ...p, [part.id]: e.target.value }))}
                      className={`flex-1 min-w-0 px-2 py-1.5 border border-ink-200 rounded-lg text-xs bg-white outline-none focus:ring-2 ${a.ring}`}>
                      <option value="">{tx('selectPlaceholder')}</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <span className={`w-24 flex-shrink-0 px-2 py-1.5 border rounded-lg text-xs text-right ${
                      stock === null ? 'bg-ink-50 border-ink-200 text-ink-400'
                        : stock < 0 ? 'bg-red-50 border-red-200 text-red-600 font-medium'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'}`}>
                      {stock === null ? '—' : `${fmtQty(stock)} kg`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {kind === 'sale' && product && parts.length === 0 && isPairUnit(product.unit) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{tx('noPartsInfo')}</p>
            </div>
          )}

          {!isPurchase && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
                <input type="checkbox" checked={showDiscount}
                  onChange={e => { setShowDiscount(e.target.checked); if (!e.target.checked) set('discount', '0'); }}
                  className="w-4 h-4 rounded border-ink-300" />
                <span className="text-xs font-medium text-ink-500">{tx('discountPct')}</span>
              </label>
              {showDiscount && (
                <div className="flex flex-1 min-w-0">
                  <input type="text" inputMode="decimal" value={line.discount}
                    onChange={e => set('discount', normalizePriceInput(e.target.value))} onKeyDown={blockDot}
                    className={`flex-1 min-w-0 px-3 py-2 border border-ink-200 rounded-l-lg text-sm text-right outline-none focus:ring-2 ${a.ring}`} />
                  <span className="px-2 py-2 bg-ink-100 border border-l-0 border-ink-200 rounded-r-lg text-xs text-ink-500 flex items-center">%</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-ink-50 border border-ink-200 rounded-xl p-4 space-y-1">
            {discountAmount > 0.004 && (
              <>
                <div className="flex justify-between text-sm text-ink-500"><span>{tx('gross')}</span><span>{fmt(gross)} {currency}</span></div>
                <div className="flex justify-between text-sm text-red-500"><span>{tx('discount')}</span><span>-{fmt(discountAmount)} {currency}</span></div>
              </>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-ink-700">{tx('lineTotal')}</span>
              <span className="text-lg font-bold text-ink-800 tabular-nums">{fmt(net)} {currency}</span>
            </div>
          </div>

          {!isPurchase && (
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">{tx('lineNotes')}</label>
              <input value={line.notes} onChange={e => set('notes', e.target.value)} className={input} />
            </div>
          )}
        </div>

        <div className="px-5 pb-4 pt-3 border-t border-ink-100 flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-ink-200 rounded-xl text-sm text-ink-600 hover:bg-ink-50">{tx('cancel')}</button>
          <button type="submit" disabled={!canConfirm}
            className={`flex-1 py-2.5 ${a.solid} ${a.solidHover} disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2`}>
            {isNew ? <Plus className="w-4 h-4" /> : <Check className="w-4 h-4" />} {isNew ? tx('addLine') : tx('updateLine')}
          </button>
        </div>
      </form>
    </div>
  );
}
