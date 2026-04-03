'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, Pencil, X,
  Package, Calculator, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';

const UNITS = ['çift', 'adet', 'kg', 'metre', 'paket'];
const CURRENCIES = ['USD', 'EUR', 'TRY'];
const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function convertCurrency(amount: number, from: string, to: string, usdToTry: number, eurToTry: number) {
  if (from === to || amount === 0) return amount;
  // to TRY
  const inTry = from === 'TRY' ? amount : from === 'USD' ? amount * usdToTry : amount * eurToTry;
  if (to === 'TRY') return inTry;
  if (to === 'USD') return inTry / usdToTry;
  return inTry / eurToTry;
}

function emptyPart() { return { materialId: '', materialVariantId: '', name: '', gramsPerPiece: '', wasteRate: '0' }; }
function emptyExtra() { return { name: '', amount: '', currency: 'USD' }; }

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const costRef = useRef<HTMLDivElement>(null);

  const [product, setProduct] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [priceWarning, setPriceWarning] = useState<{ totalCost: number; currency: string } | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // Edit state
  const [editForm, setEditForm] = useState<any>({});
  const [editParts, setEditParts] = useState<any[]>([]);
  const [editExtras, setEditExtras] = useState<any[]>([]);
  const [editSizes, setEditSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState('');

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/products/${params.id}`).then(r => r.json()),
      fetch('/api/materials').then(r => r.json()),
      fetch('/api/company').then(r => r.json()),
    ]).then(([prod, mats, comp]) => {
      if (!prod?.error) {
        setProduct(prod);
        setEditForm({
          name: prod.name || '',
          code: prod.code || '',
          description: prod.description || '',
          unit: prod.unit || 'çift',
          unitPrice: toPriceInput(prod.unitPrice ?? ''),
          currency: prod.currency || 'USD',
          stock: String(prod.stock ?? ''),
          notes: prod.notes || '',
          laborCostPerPair: toPriceInput(prod.laborCostPerPair ?? '0'),
          laborCurrency: prod.laborCurrency || 'USD',
          ciftPerKoli: String(prod.ciftPerKoli ?? '0'),
          koliFiyati: toPriceInput(prod.koliFiyati ?? '0'),
          koliCurrency: prod.koliCurrency || 'USD',
        });
        setEditParts((prod.parts || []).map((p: any) => ({
          materialId: p.materialId || '',
          materialVariantId: p.materialVariantId || '',
          name: p.name,
          gramsPerPiece: String(p.gramsPerPiece),
          wasteRate: String(p.wasteRate),
        })));
        setEditExtras((prod.extraCosts || []).map((e: any) => ({
          name: e.name,
          amount: toPriceInput(e.amount),
          currency: e.currency,
        })));
        setEditSizes(prod.sizes || []);
      }
      setMaterials(Array.isArray(mats) ? mats : []);
      if (comp && !comp.error) setCompany(comp);
    }).finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    // Validate: part name required
    const emptyName = editParts.find(p => !p.name.trim());
    if (emptyName) { alert('Tüm parçalar için parça adı girilmelidir.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          unitPrice: fromPriceInput(editForm.unitPrice),
          laborCostPerPair: fromPriceInput(editForm.laborCostPerPair),
          koliFiyati: fromPriceInput(editForm.koliFiyati),
          parts: editParts,
          extraCosts: editExtras.map((e: any) => ({ ...e, amount: fromPriceInput(e.amount) })),
          sizes: editSizes,
        }),
      });
      const updated = await res.json();
      if (!updated?.error) { setProduct(updated); setEditing(false); }
    } finally { setSaving(false); }
  };

  const handleUpdatePrice = async () => {
    if (!newPrice || fromPriceInput(newPrice) <= 0) return;
    setUpdatingPrice(true);
    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, unitPrice: fromPriceInput(newPrice), parts: product.parts, extraCosts: product.extraCosts }),
      });
      const updated = await res.json();
      if (!updated?.error) { setProduct(updated); setPriceWarning(null); }
    } finally { setUpdatingPrice(false); }
  };

  // Computed cost values
  const calcCosts = useCallback(() => {
    if (!product || !company) return null;
    const usdToTry = company.usdToTry || 1;
    const eurToTry = company.eurToTry || 1;
    const toCurrency = product.currency;

    let totalMaterialCost = 0;
    const partCosts = (product.parts || []).map((p: any) => {
      if (!p.material) return { ...p, netGrams: p.gramsPerPiece, brutGrams: p.gramsPerPiece, cost: 0 };
      const netGrams = p.gramsPerPiece; // user enters NET gram
      const brutGrams = netGrams * (1 + p.wasteRate / 100); // fire increases raw material needed
      const brutKg = brutGrams / 1000;
      const priceConverted = convertCurrency(p.material.pricePerKg, p.material.currency, toCurrency, usdToTry, eurToTry);
      const cost = brutKg * priceConverted;
      totalMaterialCost += cost;
      return { ...p, netGrams, brutGrams, cost };
    });

    const laborCost = convertCurrency(product.laborCostPerPair, product.laborCurrency, toCurrency, usdToTry, eurToTry);

    const packagingCostPerPair = product.ciftPerKoli > 0
      ? convertCurrency(product.koliFiyati, product.koliCurrency, toCurrency, usdToTry, eurToTry) / product.ciftPerKoli
      : 0;

    let totalExtraCost = 0;
    const extraConverted = (product.extraCosts || []).map((e: any) => {
      const c = convertCurrency(e.amount, e.currency, toCurrency, usdToTry, eurToTry);
      totalExtraCost += c;
      return { ...e, converted: c };
    });

    const totalCost = totalMaterialCost + laborCost + packagingCostPerPair + totalExtraCost;

    return { partCosts, totalMaterialCost, laborCost, packagingCostPerPair, extraConverted, totalExtraCost, totalCost, toCurrency };
  }, [product, company]);

  const costs = calcCosts();

  const addPart = () => setEditParts(p => [...p, emptyPart()]);
  const removePart = (i: number) => setEditParts(p => p.filter((_, idx) => idx !== i));
  const setPart = (i: number, f: string, v: string) =>
    setEditParts(p => p.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  const onMaterialSelect = (i: number, matId: string) => {
    setEditParts(p => p.map((row, idx) => idx === i ? { ...row, materialId: matId, materialVariantId: '' } : row));
  };

  const onVariantSelect = (i: number, variantId: string) => {
    setEditParts(p => p.map((row, idx) => idx === i ? { ...row, materialVariantId: variantId } : row));
  };

  const addExtra = () => setEditExtras(p => [...p, emptyExtra()]);
  const removeExtra = (i: number) => setEditExtras(p => p.filter((_, idx) => idx !== i));
  const setExtra = (i: number, f: string, v: string) =>
    setEditExtras(p => p.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  if (!product) return <AppShell><div className="text-center py-16 text-slate-400">Ürün bulunamadı</div></AppShell>;

  const parts: any[] = product.parts || [];
  const totalGrams = parts.reduce((s: number, p: any) => s + p.gramsPerPiece, 0);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            setShowCost(true);
            setTimeout(() => costRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            if (costs && product && costs.totalCost > product.unitPrice) {
              setNewPrice(toPriceInput(costs.totalCost.toFixed(4)));
              setPriceWarning({ totalCost: costs.totalCost, currency: costs.toCurrency });
            }
          }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            <Calculator className="w-4 h-4" /> Maliyet Hesapla
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium">
              <Pencil className="w-4 h-4" /> Düzenle
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
              </button>
              <button onClick={() => { setEditing(false); load(); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
                <X className="w-4 h-4" /> Vazgeç
              </button>
            </>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Product info + cost summary */}
          <div className="space-y-3">
            {/* Product header */}
            <div className="bg-blue-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{product.name}</p>
                {product.code && <p className="text-blue-200 text-xs mt-0.5">Kod: {product.code}</p>}
              </div>
              <Package className="w-5 h-5 text-blue-300" />
            </div>

            {/* Product meta */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {editing && (
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">Düzenleme modu aktif</p>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Ürün Adı', field: 'name', type: 'text', value: product.name },
                  { label: 'Kod', field: 'code', type: 'text', value: product.code || '—' },
                  { label: 'Birim', field: 'unit', type: 'sel-unit', value: product.unit },
                  { label: 'Fiyat', field: 'unitPrice', type: 'number', value: `${fmt2(product.unitPrice)} ${product.currency}` },
                  { label: 'Para Birimi', field: 'currency', type: 'sel-cur', value: product.currency },
                  { label: 'Stok', field: 'stock', type: 'number', value: `${product.stock} ${product.unit}` },
                ].map(row => (
                  <div key={row.field} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    {editing ? (
                      row.type === 'sel-unit' ? (
                        <select value={editForm[row.field]} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      ) : row.type === 'sel-cur' ? (
                        <select value={editForm[row.field]} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : row.field === 'unitPrice' ? (
                        <input type="text" inputMode="decimal"
                          value={editForm[row.field]}
                          onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: normalizePriceInput(e.target.value) }))}
                          onKeyDown={blockDot}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                      ) : (
                        <input type={row.type === 'number' ? 'number' : 'text'} step="0.01"
                          value={editForm[row.field]}
                          onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                      )
                    ) : (
                      <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                    )}
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Notlar</span>
                  {editing ? (
                    <textarea value={editForm.notes} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  ) : (
                    <p className="text-sm text-slate-600">{product.notes || <span className="text-slate-300 italic">—</span>}</p>
                  )}
                </div>

                {/* Boylar */}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-2">Boylar</span>
                  {editing ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={sizeInput}
                          onChange={e => setSizeInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const vals = sizeInput.split(',').map(v => v.trim()).filter(Boolean);
                              setEditSizes(p => {
                                const next = [...p];
                                vals.forEach(v => { if (!next.includes(v)) next.push(v); });
                                return next;
                              });
                              setSizeInput('');
                            }
                          }}
                          placeholder="36,37,38 veya S,M,L"
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const vals = sizeInput.split(',').map(v => v.trim()).filter(Boolean);
                            setEditSizes(p => {
                              const next = [...p];
                              vals.forEach(v => { if (!next.includes(v)) next.push(v); });
                              return next;
                            });
                            setSizeInput('');
                          }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                        >
                          Ekle
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">Virgülle ayırarak toplu ekleyebilirsiniz: <span className="font-medium text-slate-500">36,37,38,39,40</span></p>
                      <div className="flex flex-wrap gap-1.5">
                        {editSizes.map(s => (
                          <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            {s}
                            <button type="button" onClick={() => setEditSizes(p => p.filter(x => x !== s))} className="hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {editSizes.length === 0 && <span className="text-xs text-slate-400 italic">Henüz boy eklenmedi</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(product.sizes || []).length === 0
                        ? <span className="text-sm text-slate-300 italic">—</span>
                        : (product.sizes || []).map((s: string) => (
                            <span key={s} className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{s}</span>
                          ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Maliyet Özeti */}
            {costs && (
              <div ref={costRef} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button onClick={() => setShowCost(s => !s)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-blue-600 hover:bg-blue-700 transition-colors">
                  <span className="text-white font-bold text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Maliyet Özeti
                  </span>
                  {showCost ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                </button>
                {showCost && (
                  <div className="p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Hammadde Maliyeti</span>
                      <span className="font-medium">{fmt2(costs.totalMaterialCost)} {costs.toCurrency}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>İşçilik Maliyeti</span>
                      <span className="font-medium">{fmt2(costs.laborCost)} {costs.toCurrency}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Koli Maliyeti (çift başına)</span>
                      <span className="font-medium">{fmt2(costs.packagingCostPerPair)} {costs.toCurrency}</span>
                    </div>
                    {costs.extraConverted.map((e: any) => (
                      <div key={e.name} className="flex justify-between text-slate-600">
                        <span>{e.name}</span>
                        <span className="font-medium">{fmt2(e.converted)} {costs.toCurrency}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-slate-800 text-base pt-2 border-t border-slate-200">
                      <span>TOPLAM MALİYET</span>
                      <span className="text-blue-700">{fmt2(costs.totalCost)} {costs.toCurrency}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: All sections */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── 1. Parça / Hammadde ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Parça / Hammadde Listesi</h2>
                {editing && (
                  <button onClick={addPart}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" /> Parça Ekle
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-blue-50 text-xs font-semibold text-slate-600 border-b border-blue-100">
                      <th className="px-3 py-2.5 text-left w-8">#</th>
                      <th className="px-3 py-2.5 text-left">Hammadde</th>
                      <th className="px-3 py-2.5 text-left">Parça Adı</th>
                      <th className="px-3 py-2.5 text-right">Net Gram</th>
                      <th className="px-3 py-2.5 text-right">Fire %</th>
                      <th className="px-3 py-2.5 text-right">Brüt Gram</th>
                      {!editing && <th className="px-3 py-2.5 text-right">Maliyet</th>}
                      {editing && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {editing ? (
                      editParts.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">Henüz parça eklenmedi.</td></tr>
                      ) : editParts.map((part, idx) => {
                        const net = parseFloat(part.gramsPerPiece) || 0;
                        const fire = parseFloat(part.wasteRate) || 0;
                        const brut = net * (1 + fire / 100);
                        const nameEmpty = !part.name.trim();
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <select value={part.materialId} onChange={e => onMaterialSelect(idx, e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none focus:ring-1 focus:ring-blue-400">
                                <option value="">— Seç —</option>
                                {materials.map(m => (
                                  <option key={m.id} value={m.id}>{m.name} ({fmt(m.pricePerKg)} {m.currency}/kg)</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input value={part.name} onChange={e => setPart(idx, 'name', e.target.value)}
                                placeholder="Parça adı *"
                                className={`w-full px-2 py-1 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-400 ${nameEmpty ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" min="0" value={part.gramsPerPiece}
                                onChange={e => setPart(idx, 'gramsPerPiece', e.target.value)}
                                placeholder="0"
                                className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <input type="number" step="0.1" min="0" max="100" value={part.wasteRate}
                                  onChange={e => setPart(idx, 'wasteRate', e.target.value)}
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                                <span className="text-xs text-slate-400">%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 font-medium">{brut > 0 ? fmt2(brut) : '—'}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => removePart(idx)} className="p-1 text-red-400 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      parts.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-300 text-sm">Parça eklenmemiş</td></tr>
                      ) : parts.map((part: any, idx: number) => {
                        const netGrams = part.gramsPerPiece; // user-entered net
                        const brutGrams = netGrams * (1 + part.wasteRate / 100); // calculated
                        const partCost = costs?.partCosts?.[idx]?.cost ?? 0;
                        return (
                          <tr key={part.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-slate-700">{part.material?.name || '—'}</p>
                              {part.material && <p className="text-xs text-slate-400">{fmt(part.material.pricePerKg)} {part.material.currency}/kg</p>}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{part.name}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{fmt2(netGrams)} gr</td>
                            <td className="px-3 py-2.5 text-right text-slate-500">%{part.wasteRate}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700 font-medium">{fmt2(brutGrams)} gr</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-blue-700">
                              {costs ? `${fmt2(partCost)} ${costs.toCurrency}` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {!editing && parts.length > 0 && costs && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                        <td colSpan={3} className="px-3 py-2.5 text-blue-800 text-sm">TOPLAM</td>
                        <td className="px-3 py-2.5 text-right text-blue-800">{fmt2(totalGrams)} gr</td>
                        <td></td>
                        <td className="px-3 py-2.5 text-right text-blue-800">
                          {fmt2(parts.reduce((s: number, p: any) => s + p.gramsPerPiece * (1 + p.wasteRate / 100), 0))} gr
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-700">{fmt2(costs.totalMaterialCost)} {costs.toCurrency}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* ── 2. İşçilik Maliyeti ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-green-600 px-4 py-3">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">İşçilik Maliyeti</h2>
              </div>
              <div className="p-4">
                {editing ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Çift Başına İşçilik</label>
                      <input type="text" inputMode="decimal" value={editForm.laborCostPerPair}
                        onChange={e => setEditForm((p: any) => ({ ...p, laborCostPerPair: normalizePriceInput(e.target.value) }))}
                        onKeyDown={blockDot}
                        placeholder="0"
                        className="w-36 px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Para Birimi</label>
                      <select value={editForm.laborCurrency}
                        onChange={e => setEditForm((p: any) => ({ ...p, laborCurrency: e.target.value }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Çift başına işçilik maliyeti</span>
                    <span className="font-bold text-green-700 text-base">
                      {fmt2(product.laborCostPerPair)} {product.laborCurrency}
                      {costs && product.laborCurrency !== product.currency && (
                        <span className="text-xs font-normal text-slate-400 ml-2">
                          ≈ {fmt2(costs.laborCost)} {product.currency}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. Koli Maliyeti ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-orange-500 px-4 py-3">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Koli Maliyeti</h2>
              </div>
              <div className="p-4">
                {editing ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Kolide Çift Sayısı</label>
                      <input type="number" step="1" min="0" value={editForm.ciftPerKoli}
                        onChange={e => setEditForm((p: any) => ({ ...p, ciftPerKoli: e.target.value }))}
                        placeholder="0"
                        className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Koli Fiyatı</label>
                      <input type="text" inputMode="decimal" value={editForm.koliFiyati}
                        onChange={e => setEditForm((p: any) => ({ ...p, koliFiyati: normalizePriceInput(e.target.value) }))}
                        onKeyDown={blockDot}
                        placeholder="0"
                        className="w-36 px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Para Birimi</label>
                      <select value={editForm.koliCurrency}
                        onChange={e => setEditForm((p: any) => ({ ...p, koliCurrency: e.target.value }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Kolide Çift</p>
                      <p className="font-semibold text-slate-700">{product.ciftPerKoli} çift</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Koli Fiyatı</p>
                      <p className="font-semibold text-slate-700">{fmt2(product.koliFiyati)} {product.koliCurrency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Çift Başına Koli</p>
                      <p className="font-bold text-orange-600">
                        {costs && product.ciftPerKoli > 0
                          ? `${fmt2(costs.packagingCostPerPair)} ${product.currency}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── 4. Ekstra Maliyetler ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Ekstra Maliyetler</h2>
                {editing && (
                  <button onClick={addExtra}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" /> Ekle
                  </button>
                )}
              </div>
              {editing ? (
                <div className="p-4 space-y-2">
                  {editExtras.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Ekstra maliyet eklenmedi.</p>
                  ) : editExtras.map((ec, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={ec.name} onChange={e => setExtra(idx, 'name', e.target.value)}
                        placeholder="Maliyet adı (örn: Nakliye)"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-400" />
                      <input type="text" inputMode="decimal" value={ec.amount} onChange={e => setExtra(idx, 'amount', normalizePriceInput(e.target.value))}
                        onKeyDown={blockDot}
                        placeholder="0"
                        className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-purple-400" />
                      <select value={ec.currency} onChange={e => setExtra(idx, 'currency', e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <button onClick={() => removeExtra(idx)} className="p-1.5 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {(!product.extraCosts || product.extraCosts.length === 0) ? (
                    <p className="text-sm text-slate-300 text-center py-6">Ekstra maliyet eklenmemiş.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-purple-50 text-xs font-semibold text-slate-600 border-b border-purple-100">
                          <th className="px-4 py-2.5 text-left">Açıklama</th>
                          <th className="px-4 py-2.5 text-right">Tutar</th>
                          {costs && <th className="px-4 py-2.5 text-right">{product.currency} cinsinden</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {product.extraCosts.map((ec: any, idx: number) => (
                          <tr key={ec.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 text-slate-700">{ec.name}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-slate-600">{fmt2(ec.amount)} {ec.currency}</td>
                            {costs && (
                              <td className="px-4 py-2.5 text-right font-semibold text-purple-700">
                                {fmt2(costs.extraConverted[idx]?.converted ?? 0)} {product.currency}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      {costs && (
                        <tfoot>
                          <tr className="bg-purple-50 border-t-2 border-purple-200 font-bold">
                            <td className="px-4 py-2.5 text-purple-800 text-sm">TOPLAM</td>
                            <td></td>
                            <td className="px-4 py-2.5 text-right text-purple-700">{fmt2(costs.totalExtraCost)} {product.currency}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Price Warning Modal */}
      {priceWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPriceWarning(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">⚠️ Fiyat Uyarısı</h3>
              <button onClick={() => setPriceWarning(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-700 text-sm font-medium">
                Dikkat! Ürün satış fiyatı hesaplanan maliyet fiyatından düşük.
              </p>
              <div className="bg-red-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mevcut Satış Fiyatı</span>
                  <span className="font-semibold text-slate-700">{fmt2(product.unitPrice)} {product.currency}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold border-t border-red-200 pt-2">
                  <span>Hesaplanan Maliyet</span>
                  <span>{fmt2(priceWarning.totalCost)} {priceWarning.currency}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Yeni Satış Fiyatı ({product.currency})</label>
                <input
                  type="text" inputMode="decimal"
                  value={newPrice}
                  onChange={e => setNewPrice(normalizePriceInput(e.target.value))}
                  onKeyDown={blockDot}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-400 font-medium"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPriceWarning(null)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Vazgeç
                </button>
                <button onClick={handleUpdatePrice} disabled={updatingPrice || !newPrice}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {updatingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Fiyatı Güncelle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
