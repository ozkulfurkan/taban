'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import { Loader2, Save, Plus, Trash2, Pencil, X, Package, Calculator, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Warehouse, FileText, Users, AlertTriangle, QrCode } from '@/app/components/icons';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';
import { buildPrintHtml, type BarcodeTemplateSettings } from '@/lib/barcode-print';
import { KoliLabelModal } from '@/app/components/koli-label-modal';
import DecimalInput from '@/app/components/decimal-input';
import BackLink from '@/app/components/back-link';
import { ProductImageEditor } from '@/app/components/product-image';

const ALL_UNITS = ['çift', 'adet', 'kg', 'ton', 'lt', 'metre', 'paket'];

function parseSizeInput(input: string): string[] {
  const result: string[] = [];
  for (const part of input.split(',').map(v => v.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) {
      const [from, to] = [parseInt(m[1]), parseInt(m[2])];
      const step = from <= to ? 1 : -1;
      for (let i = from; step > 0 ? i <= to : i >= to; i += step) result.push(String(i));
    } else {
      result.push(part);
    }
  }
  return result;
}
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

function emptyPart() { return { materialId: '', name: '', gramsPerPiece: '', wasteRate: '0' }; }
function emptyExtra() { return { name: '', amount: '', currency: 'USD' }; }

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const costRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const companyType = (session?.user as any)?.companyType ?? 'SOLE_MANUFACTURER';
  const canEditImage = !!(session?.user as any)?.role && (session?.user as any)?.role !== 'VIEWER';
  const isMaterial = companyType === 'MATERIAL_SUPPLIER';
  const UNITS = isMaterial ? ['kg', 'ton', 'lt', 'adet'] : ALL_UNITS;

  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // New material modal
  const [showMatModal, setShowMatModal] = useState(false);
  const [matModalRow, setMatModalRow] = useState<number | null>(null);
  const [newMatForm, setNewMatForm] = useState({ name: '', pricePerKg: '', currency: 'USD' });
  const [savingMat, setSavingMat] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [priceWarning, setPriceWarning] = useState<{ totalCost: number; currency: string } | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // Stok yönetimi
  const [stokAmt, setStokAmt] = useState('');
  const [stokLoading, setStokLoading] = useState(false);

  // Stok hareketleri (MATERIAL_SUPPLIER)
  const [ekstre, setEkstre] = useState<any[]>([]);
  const [ekstreLoading, setEkstreLoading] = useState(false);

  // Müşteri özel fiyatlar
  const [productPrices, setProductPrices] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [ppForm, setPpForm] = useState({ customerId: '', unitPrice: '', currency: 'TRY' });
  const [ppSaving, setPpSaving] = useState(false);

  // Koli etiketi (tabancı/ayakkabıcı); hammaddeci firmalar aşağıdaki barkod etiketini kullanır
  const [showKoli, setShowKoli] = useState(false);

  // Barkod
  const [showBarcode, setShowBarcode] = useState(false);
  const [barcodeSettings, setBarcodeSettings] = useState<Partial<BarcodeTemplateSettings>>({});
  const [barcodeForm, setBarcodeForm] = useState({
    companyName: '', productName: '', productCode: '', logoUrl: '', date: '', shore: '',
    qtyPerPack: '1', qtyUnit: 'adet', labelCount: '1', addToStock: true,
  });
  const [barcodeNumbers, setBarcodeNumbers] = useState<string[]>([]);
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const handleStok = async (sign: 1 | -1) => {
    const amt = parseFloat(stokAmt);
    if (!amt || amt <= 0) return;
    setStokLoading(true);
    try {
      const res = await fetch(`/api/products/${params.id}/stok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: sign * amt }),
      });
      const data = await res.json();
      if (data.stock !== undefined) {
        setProduct((p: any) => ({ ...p, stock: data.stock }));
        setStokAmt('');
      }
    } finally { setStokLoading(false); }
  };

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
          categoryId: prod.categoryId || '',
          renk: prod.renk || '',
          shore: prod.shore || '',
          laborCostPerPair: toPriceInput(prod.laborCostPerPair ?? '0'),
          laborCurrency: prod.laborCurrency || 'USD',
          ciftPerKoli: String(prod.ciftPerKoli ?? '0'),
          koliFiyati: toPriceInput(prod.koliFiyati ?? '0'),
          koliCurrency: prod.koliCurrency || 'USD',
        });
        setEditParts((prod.parts || []).map((p: any) => ({
          materialId: p.materialId || '',
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

  useEffect(() => {
    fetch('/api/product-categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (searchParams?.get('edit') === 'true') setEditing(true);
  }, [searchParams]);

  useEffect(() => {
    if (!params?.id || !isMaterial) return;
    setEkstreLoading(true);
    fetch(`/api/products/${params.id}/ekstre`).then(r => r.json()).then(d => {
      setEkstre(Array.isArray(d?.entries) ? d.entries : []);
    }).finally(() => setEkstreLoading(false));
  }, [params?.id, isMaterial]);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/products/${params.id}/prices`).then(r => r.json()).then(d => setProductPrices(Array.isArray(d) ? d : []));
    fetch('/api/customers?minimal=true').then(r => r.json()).then(d => setAllCustomers(Array.isArray(d) ? d : []));
  }, [params?.id]);

  const makeBarcodeNumbers = (count: number): string[] => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const prefix = `${mm}${dd}-${yy}`;
    return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`);
  };

  const handleBarcodeOpen = async () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const settingsRes = await fetch('/api/settings/barcode').then(r => r.json());
    const s = settingsRes && !settingsRes.error ? settingsRes : {};
    setBarcodeSettings(s);
    setBarcodeNumbers(makeBarcodeNumbers(1));
    setBarcodeForm({
      companyName: company?.name || '',
      productName: product?.name || '',
      productCode: product?.code || '',
      logoUrl: company?.logoUrl || '',
      date: `${dd}/${mm}/${yyyy}`,
      shore: product?.shore || '65±2',
      qtyPerPack: s.defaultQtyPerPack ?? '1',
      qtyUnit: s.defaultQtyUnit ?? 'adet',
      labelCount: '1',
      addToStock: true,
    });
    setShowBarcode(true);
  };

  const handleBarcodeLabelCountChange = (val: string) => {
    setBarcodeForm(f => ({ ...f, labelCount: val }));
    const count = Math.max(1, parseInt(val) || 1);
    setBarcodeNumbers(makeBarcodeNumbers(count));
  };

  const handlePrint = async () => {
    setBarcodeLoading(true);
    try {
      const count = Math.max(1, parseInt(barcodeForm.labelCount) || 1);
      const numbers = makeBarcodeNumbers(count);
      if (barcodeForm.addToStock) {
        const qty = parseFloat(barcodeForm.qtyPerPack.replace(',', '.')) * count;
        await fetch('/api/barcode/stock-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: params.id, quantity: qty }),
        });
        load();
      }
      const html = buildPrintHtml(numbers, barcodeForm, barcodeSettings);
      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); }
      setShowBarcode(false);
    } finally { setBarcodeLoading(false); }
  };

  const handleSave = async () => {
    // Validate: part name required
    const emptyName = editParts.find(p => !p.name.trim());
    if (emptyName) { setErrorMsg('Tüm parçalar için parça adı girilmelidir.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          // Sunucu stoğu fark olarak uygular; form açıkken kesilen faturaların düşümü kaybolmaz
          stockLoaded: product.stock,
          unitPrice: fromPriceInput(editForm.unitPrice),
          laborCostPerPair: fromPriceInput(editForm.laborCostPerPair),
          koliFiyati: fromPriceInput(editForm.koliFiyati),
          categoryId: editForm.categoryId || null,
          parts: editParts,
          extraCosts: editExtras.map((e: any) => ({ ...e, amount: fromPriceInput(e.amount) })),
          sizes: editSizes,
        }),
      });
      const updated = await res.json();
      if (!updated?.error) { setProduct(updated); setEditing(false); }
    } finally { setSaving(false); }
  };

  const handleAddProductPrice = async () => {
    if (!ppForm.customerId || !ppForm.unitPrice) return;
    setPpSaving(true);
    await fetch(`/api/products/${params.id}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: ppForm.customerId, unitPrice: parseFloat(ppForm.unitPrice.replace(',', '.')), currency: ppForm.currency }),
    });
    const updated = await fetch(`/api/products/${params.id}/prices`).then(r => r.json());
    setProductPrices(Array.isArray(updated) ? updated : []);
    setPpForm({ customerId: '', unitPrice: '', currency: 'TRY' });
    setPpSaving(false);
  };

  const handleDeleteProductPrice = async (customerId: string) => {
    await fetch(`/api/products/${params.id}/prices/${customerId}`, { method: 'DELETE' });
    setProductPrices(prev => prev.filter(p => p.customerId !== customerId));
  };

  const handleUpdatePrice = async () => {
    if (!newPrice || fromPriceInput(newPrice) <= 0) return;
    setUpdatingPrice(true);
    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, stockLoaded: product.stock, unitPrice: fromPriceInput(newPrice), parts: product.parts, extraCosts: product.extraCosts }),
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
    setEditParts(p => p.map((row, idx) => idx === i ? { ...row, materialId: matId } : row));
  };

  const addExtra = () => setEditExtras(p => [...p, emptyExtra()]);
  const removeExtra = (i: number) => setEditExtras(p => p.filter((_, idx) => idx !== i));
  const setExtra = (i: number, f: string, v: string) =>
    setEditExtras(p => p.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  const handleNewMaterial = async () => {
    if (!newMatForm.name.trim() || !newMatForm.pricePerKg) return;
    setSavingMat(true);
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMatForm.name,
          pricePerKg: fromPriceInput(newMatForm.pricePerKg),
          currency: newMatForm.currency,
        }),
      });
      const newMat = await res.json();
      if (newMat.id) {
        const mats = await fetch('/api/materials').then(r => r.json());
        setMaterials(Array.isArray(mats) ? mats : []);
        if (matModalRow !== null) onMaterialSelect(matModalRow, newMat.id);
        setShowMatModal(false);
        setNewMatForm({ name: '', pricePerKg: '', currency: 'USD' });
        setMatModalRow(null);
      }
    } finally { setSavingMat(false); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div></AppShell>;
  if (!product) return <AppShell><div className="text-center py-16 text-ink-400">Ürün bulunamadı</div></AppShell>;

  const parts: any[] = product.parts || [];
  const totalGrams = parts.reduce((s: number, p: any) => s + p.gramsPerPiece, 0);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">

        {/* Back */}
        <BackLink href="/products" label="Ürünler" />

        {product && (
          <ProductImageEditor productId={product.id} imageUpdatedAt={product.imageUpdatedAt ?? null} canEdit={canEditImage}
            onChange={v => setProduct((p: any) => ({ ...p, imageUpdatedAt: v }))} />
        )}

        {!isMaterial && !showCost && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Ürün bilgilerini girdikten sonra Maliyet Hesapla butonuna tıklayın.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isMaterial ? (
          <button onClick={handleBarcodeOpen}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold shadow-md">
            <QrCode className="w-4 h-4" /> Barkod Yazdır
          </button>
          ) : (
          <button onClick={() => setShowKoli(true)} data-testid="koli-open"
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold shadow-md">
            <QrCode className="w-4 h-4" /> Koli Etiketi
          </button>
          )}
          {!isMaterial && (
          <button onClick={() => {
            setShowCost(true);
            setTimeout(() => costRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            if (costs && product && costs.totalCost > product.unitPrice) {
              setNewPrice(toPriceInput(costs.totalCost.toFixed(4)));
              setPriceWarning({ totalCost: costs.totalCost, currency: costs.toCurrency });
            }
          }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold shadow-md">
            <Calculator className="w-4 h-4" /> Maliyet Hesapla
          </button>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium">
              <Pencil className="w-4 h-4" /> Düzenle
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
              </button>
              <button onClick={() => { setEditing(false); load(); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-ink-200 hover:bg-ink-300 text-ink-700 rounded-lg text-sm font-medium">
                <X className="w-4 h-4" /> Vazgeç
              </button>
            </>
          )}
        </div>

        {/* Two-column layout */}
        <div className={`grid grid-cols-1 ${isMaterial ? 'lg:grid-cols-[300px_1fr]' : 'lg:grid-cols-3'} gap-4`}>

          {/* LEFT: Product info + cost summary */}
          <div className="space-y-3">
            {/* Product header */}
            <div className="bg-brand-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{product.name}</p>
                {product.code && <p className="text-brand-200 text-xs mt-0.5">Kod: {product.code}</p>}
              </div>
              <Package className="w-5 h-5 text-brand-300" />
            </div>

            {/* Product meta */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              {editing && (
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">Düzenleme modu aktif</p>
                </div>
              )}
              <div className="divide-y divide-ink-100">
                {[
                  { label: 'Ürün Adı', field: 'name', type: 'text', value: product.name },
                  { label: 'Kod', field: 'code', type: 'text', value: product.code || '—' },
                  { label: 'Birim', field: 'unit', type: 'sel-unit', value: product.unit },
                  { label: 'Fiyat', field: 'unitPrice', type: 'number', value: `${fmt2(product.unitPrice)} ${product.currency}` },
                  { label: 'Para Birimi', field: 'currency', type: 'sel-cur', value: product.currency },
                  { label: 'Stok', field: 'stock', type: 'number', value: `${product.stock} ${product.unit}` },
                ].map(row => (
                  <div key={row.field} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-semibold text-ink-500 w-24 flex-shrink-0">{row.label}</span>
                    {editing ? (
                      row.type === 'sel-unit' ? (
                        <select value={editForm[row.field]} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm bg-white outline-none">
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      ) : row.type === 'sel-cur' ? (
                        <select value={editForm[row.field]} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm bg-white outline-none">
                          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : row.field === 'unitPrice' ? (
                        <input type="text" inputMode="decimal"
                          value={editForm[row.field]}
                          onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: normalizePriceInput(e.target.value) }))}
                          onKeyDown={blockDot}
                          className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500" />
                      ) : (
                        <input type={row.type === 'number' ? 'number' : 'text'} step="0.01"
                          value={editForm[row.field]}
                          onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500" />
                      )
                    ) : (
                      <span className="text-sm text-ink-700 font-medium">{row.value}</span>
                    )}
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-ink-500 block mb-1">Kategori</span>
                  {editing ? (
                    <select value={editForm.categoryId} onChange={e => setEditForm((p: any) => ({ ...p, categoryId: e.target.value }))}
                      className="w-full px-2 py-1 border border-ink-200 rounded text-sm bg-white outline-none focus:ring-1 focus:ring-brand-500">
                      <option value="">— Seç —</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-ink-600">{product.category?.name || <span className="text-ink-300 italic">—</span>}</p>
                  )}
                </div>
                <div className="px-4 py-2.5 flex items-center">
                  <span className="text-xs font-semibold text-ink-500 w-24 flex-shrink-0">Renk</span>
                  {editing ? (
                    <input type="text" value={editForm.renk} onChange={e => setEditForm((p: any) => ({ ...p, renk: e.target.value }))}
                      className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500" />
                  ) : (
                    <span className="text-sm text-ink-700">{product.renk || <span className="text-ink-300 italic">—</span>}</span>
                  )}
                </div>
                <div className="px-4 py-2.5 flex items-center">
                  <span className="text-xs font-semibold text-ink-500 w-24 flex-shrink-0">Shore</span>
                  {editing ? (
                    <input type="text" value={editForm.shore} onChange={e => setEditForm((p: any) => ({ ...p, shore: e.target.value }))}
                      className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500" />
                  ) : (
                    <span className="text-sm text-ink-700">{product.shore || <span className="text-ink-300 italic">—</span>}</span>
                  )}
                </div>
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-ink-500 block mb-1">Notlar</span>
                  {editing ? (
                    <textarea value={editForm.notes} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-ink-200 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500 resize-none" />
                  ) : (
                    <p className="text-sm text-ink-600">{product.notes || <span className="text-ink-300 italic">—</span>}</p>
                  )}
                </div>

                {/* Boylar */}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-ink-500 block mb-2">Boylar</span>
                  {editing ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={sizeInput}
                          onChange={e => setSizeInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const vals = parseSizeInput(sizeInput);
                              setEditSizes(p => {
                                const next = [...p];
                                vals.forEach(v => { if (!next.includes(v)) next.push(v); });
                                return next;
                              });
                              setSizeInput('');
                            }
                          }}
                          placeholder="36-40 veya 36,37,38 veya S,M,L"
                          className="flex-1 px-2 py-1 border border-ink-200 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const vals = parseSizeInput(sizeInput);
                            setEditSizes(p => {
                              const next = [...p];
                              vals.forEach(v => { if (!next.includes(v)) next.push(v); });
                              return next;
                            });
                            setSizeInput('');
                          }}
                          className="px-2 py-1 bg-brand-700 hover:bg-brand-800 text-white rounded text-xs font-medium"
                        >
                          Ekle
                        </button>
                      </div>
                      <p className="text-xs text-ink-400">
                        Asorti aralığı girerseniz o numaralar listelenir: <span className="font-medium text-ink-500">36-40</span>
                        {' '}· Virgülle toplu ekleyebilirsiniz: <span className="font-medium text-ink-500">36,37,38</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {editSizes.map(s => (
                          <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-800 rounded-full text-xs font-semibold">
                            {s}
                            <button type="button" onClick={() => setEditSizes(p => p.filter(x => x !== s))} className="hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {editSizes.length === 0 && <span className="text-xs text-ink-400 italic">Henüz boy eklenmedi</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(product.sizes || []).length === 0
                        ? <span className="text-sm text-ink-300 italic">—</span>
                        : (product.sizes || []).map((s: string) => (
                            <span key={s} className="px-2.5 py-0.5 bg-brand-100 text-brand-800 rounded-full text-xs font-semibold">{s}</span>
                          ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stok Yönetimi */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="bg-brand-700 px-4 py-3 flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-white" />
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Stok Yönetimi</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between bg-brand-50 rounded-xl px-4 py-3">
                  <span className="text-xs font-semibold text-brand-800">Güncel Stok</span>
                  <span className="text-2xl font-bold text-brand-900">
                    {product.stock} <span className="text-sm font-normal text-brand-700">{product.unit}</span>
                  </span>
                </div>
                <div className="space-y-2">
                  <DecimalInput
                    integer
                    min="0"
                    step="1"
                    value={stokAmt}
                    onChange={e => setStokAmt(e.target.value)}
                    placeholder="Miktar"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStok(1)}
                      disabled={stokLoading || !stokAmt}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                    >
                      {stokLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                      Ekle
                    </button>
                    <button
                      onClick={() => handleStok(-1)}
                      disabled={stokLoading || !stokAmt}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                    >
                      {stokLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                      Çıkar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Maliyet Özeti */}
            {!isMaterial && costs && (
              <div ref={costRef} className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
                <button onClick={() => setShowCost(s => !s)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-brand-700 hover:bg-brand-800 transition-colors">
                  <span className="text-white font-bold text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Maliyet Özeti
                  </span>
                  {showCost ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                </button>
                {showCost && (
                  <div className="p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-ink-600">
                      <span>Hammadde Maliyeti</span>
                      <span className="font-medium">{fmt2(costs.totalMaterialCost)} {costs.toCurrency}</span>
                    </div>
                    <div className="flex justify-between text-ink-600">
                      <span>İşçilik Maliyeti</span>
                      <span className="font-medium">{fmt2(costs.laborCost)} {costs.toCurrency}</span>
                    </div>
                    <div className="flex justify-between text-ink-600">
                      <span>Koli Maliyeti (çift başına)</span>
                      <span className="font-medium">{fmt2(costs.packagingCostPerPair)} {costs.toCurrency}</span>
                    </div>
                    {costs.extraConverted.map((e: any) => (
                      <div key={e.name} className="flex justify-between text-ink-600">
                        <span>{e.name}</span>
                        <span className="font-medium">{fmt2(e.converted)} {costs.toCurrency}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-ink-800 text-base pt-2 border-t border-ink-200">
                      <span>TOPLAM MALİYET</span>
                      <span className="text-brand-800">{fmt2(costs.totalCost)} {costs.toCurrency}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: stok hareketleri (isMaterial) OR cost sections (!isMaterial) */}
          {isMaterial ? (
            <div className="bg-white rounded-xl shadow-card overflow-hidden self-start border border-ink-200/80">
              <div className="bg-brand-800 px-4 py-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                <h2 className="text-white font-semibold text-sm">Stok Hareketleri</h2>
              </div>
              {ekstreLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-brand-700" /></div>
              ) : ekstre.length === 0 ? (
                <div className="text-center py-10 text-ink-400 text-sm">Henüz hareket kaydı yok</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-ink-500 border-b bg-ink-50">
                        <th className="px-4 py-2.5 text-left">Tarih</th>
                        <th className="px-4 py-2.5 text-left">İşlem</th>
                        <th className="px-4 py-2.5 text-left">Müşteri / Tedarikçi</th>
                        <th className="px-4 py-2.5 text-left">Fatura No</th>
                        <th className="px-4 py-2.5 text-right">Miktar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {ekstre.map((e: any) => (
                        <tr key={e.id} className="hover:bg-ink-50/50">
                          <td className="px-4 py-2.5 text-xs text-ink-500 whitespace-nowrap">
                            {new Date(e.date).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-4 py-2.5">
                            {e.type === 'satis'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Satış</span>
                              : e.type === 'alis'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-800 rounded-full text-xs font-semibold">Alış</span>
                              : e.type === 'alis_iade'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Alış İadesi</span>
                              : e.type === 'iade'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">İade</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-800 rounded-full text-xs font-semibold">Üretim</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-ink-600 text-xs">{e.party}</td>
                          <td className="px-4 py-2.5 text-ink-400 text-xs">{e.invoiceNo ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${e.qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {e.qty > 0 ? '+' : ''}{e.qty.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {product?.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : <div className="lg:col-span-2 space-y-4">

            {/* ── 1. Parça / Hammadde ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="bg-brand-700 px-4 py-3 flex items-center justify-between">
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
                    <tr className="bg-brand-50 text-xs font-semibold text-ink-600 border-b border-brand-100">
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
                  <tbody className="divide-y divide-ink-50">
                    {editing ? (
                      editParts.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-400 text-sm">Henüz parça eklenmedi.</td></tr>
                      ) : editParts.map((part, idx) => {
                        const net = parseFloat(part.gramsPerPiece) || 0;
                        const fire = parseFloat(part.wasteRate) || 0;
                        const brut = net * (1 + fire / 100);
                        const nameEmpty = !part.name.trim();
                        return (
                          <tr key={idx} className="hover:bg-ink-50/50">
                            <td className="px-3 py-2 text-ink-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2 space-y-1">
                              <select value={part.materialId} onChange={e => onMaterialSelect(idx, e.target.value)}
                                className="w-full px-2 py-1 border border-ink-200 rounded text-sm bg-white outline-none focus:ring-1 focus:ring-brand-500">
                                <option value="">— Seç —</option>
                                {materials.map(m => (
                                  <option key={m.id} value={m.id}>{m.name} ({fmt(m.pricePerKg)} {m.currency}/kg)</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => { setMatModalRow(idx); setShowMatModal(true); }}
                                className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 font-medium"
                              >
                                <Plus className="w-3 h-3" /> Yeni Hammadde
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <input value={part.name} onChange={e => setPart(idx, 'name', e.target.value)}
                                placeholder="Parça adı *"
                                className={`w-full px-2 py-1 border rounded text-sm outline-none focus:ring-1 focus:ring-brand-500 ${nameEmpty ? 'border-red-300 bg-red-50' : 'border-ink-200'}`} />
                            </td>
                            <td className="px-3 py-2">
                              <DecimalInput step="0.01" min="0" value={part.gramsPerPiece}
                                onChange={e => setPart(idx, 'gramsPerPiece', e.target.value)}
                                placeholder="0"
                                className="w-20 px-2 py-1 border border-ink-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-brand-500" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <DecimalInput step="0.1" min="0" max="100" value={part.wasteRate}
                                  onChange={e => setPart(idx, 'wasteRate', e.target.value)}
                                  className="w-16 px-2 py-1 border border-ink-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-brand-500" />
                                <span className="text-xs text-ink-400">%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-ink-600 font-medium">{brut > 0 ? fmt2(brut) : '—'}</td>
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
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-300 text-sm">Parça eklenmemiş</td></tr>
                      ) : parts.map((part: any, idx: number) => {
                        const netGrams = part.gramsPerPiece; // user-entered net
                        const brutGrams = netGrams * (1 + part.wasteRate / 100); // calculated
                        const partCost = costs?.partCosts?.[idx]?.cost ?? 0;
                        return (
                          <tr key={part.id} className="hover:bg-ink-50/50">
                            <td className="px-3 py-2.5 text-ink-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-ink-700">
                                {part.material?.name || '—'}
                              </p>
                              {part.material && <p className="text-xs text-ink-400">{fmt(part.material.pricePerKg)} {part.material.currency}/kg</p>}
                            </td>
                            <td className="px-3 py-2.5 text-ink-600">{part.name}</td>
                            <td className="px-3 py-2.5 text-right text-ink-600">{fmt2(netGrams)} gr</td>
                            <td className="px-3 py-2.5 text-right text-ink-500">%{part.wasteRate}</td>
                            <td className="px-3 py-2.5 text-right text-ink-700 font-medium">{fmt2(brutGrams)} gr</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-brand-800">
                              {costs ? `${fmt2(partCost)} ${costs.toCurrency}` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {!editing && parts.length > 0 && costs && (
                    <tfoot>
                      <tr className="bg-brand-50 border-t-2 border-brand-200 font-bold">
                        <td colSpan={3} className="px-3 py-2.5 text-brand-900 text-sm">TOPLAM</td>
                        <td className="px-3 py-2.5 text-right text-brand-900">{fmt2(totalGrams)} gr</td>
                        <td></td>
                        <td className="px-3 py-2.5 text-right text-brand-900">
                          {fmt2(parts.reduce((s: number, p: any) => s + p.gramsPerPiece * (1 + p.wasteRate / 100), 0))} gr
                        </td>
                        <td className="px-3 py-2.5 text-right text-brand-800">{fmt2(costs.totalMaterialCost)} {costs.toCurrency}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* ── 2. İşçilik Maliyeti ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="bg-emerald-600 px-4 py-3">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">İşçilik Maliyeti</h2>
              </div>
              <div className="p-4">
                {editing ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-ink-500 mb-1">Çift Başına İşçilik</label>
                      <input type="text" inputMode="decimal" value={editForm.laborCostPerPair}
                        onChange={e => setEditForm((p: any) => ({ ...p, laborCostPerPair: normalizePriceInput(e.target.value) }))}
                        onKeyDown={blockDot}
                        placeholder="0"
                        className="w-36 px-3 py-2 border border-ink-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-emerald-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-500 mb-1">Para Birimi</label>
                      <select value={editForm.laborCurrency}
                        onChange={e => setEditForm((p: any) => ({ ...p, laborCurrency: e.target.value }))}
                        className="px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white outline-none">
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-500">Çift başına işçilik maliyeti</span>
                    <span className="font-bold text-emerald-700 text-base">
                      {fmt2(product.laborCostPerPair)} {product.laborCurrency}
                      {costs && product.laborCurrency !== product.currency && (
                        <span className="text-xs font-normal text-ink-400 ml-2">
                          ≈ {fmt2(costs.laborCost)} {product.currency}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. Koli Maliyeti ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="bg-brand-600 px-4 py-3">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Koli Maliyeti</h2>
              </div>
              <div className="p-4">
                {editing ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-ink-500 mb-1">Kolide Çift Sayısı</label>
                      <DecimalInput integer step="1" min="0" value={editForm.ciftPerKoli}
                        onChange={e => setEditForm((p: any) => ({ ...p, ciftPerKoli: e.target.value }))}
                        placeholder="0"
                        className="w-28 px-3 py-2 border border-ink-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-500 mb-1">Koli Fiyatı</label>
                      <input type="text" inputMode="decimal" value={editForm.koliFiyati}
                        onChange={e => setEditForm((p: any) => ({ ...p, koliFiyati: normalizePriceInput(e.target.value) }))}
                        onKeyDown={blockDot}
                        placeholder="0"
                        className="w-36 px-3 py-2 border border-ink-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-500 mb-1">Para Birimi</label>
                      <select value={editForm.koliCurrency}
                        onChange={e => setEditForm((p: any) => ({ ...p, koliCurrency: e.target.value }))}
                        className="px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white outline-none">
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-ink-400 mb-0.5">Kolide Çift</p>
                      <p className="font-semibold text-ink-700">{product.ciftPerKoli} çift</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-400 mb-0.5">Koli Fiyatı</p>
                      <p className="font-semibold text-ink-700">{fmt2(product.koliFiyati)} {product.koliCurrency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-400 mb-0.5">Çift Başına Koli</p>
                      <p className="font-bold text-amber-600">
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
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="bg-brand-700 px-4 py-3 flex items-center justify-between">
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
                    <p className="text-sm text-ink-400 text-center py-4">Ekstra maliyet eklenmedi.</p>
                  ) : editExtras.map((ec, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={ec.name} onChange={e => setExtra(idx, 'name', e.target.value)}
                        placeholder="Maliyet adı (örn: Nakliye)"
                        className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500" />
                      <input type="text" inputMode="decimal" value={ec.amount} onChange={e => setExtra(idx, 'amount', normalizePriceInput(e.target.value))}
                        onKeyDown={blockDot}
                        placeholder="0"
                        className="w-28 px-3 py-2 border border-ink-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-brand-500" />
                      <select value={ec.currency} onChange={e => setExtra(idx, 'currency', e.target.value)}
                        className="px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white outline-none">
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
                    <p className="text-sm text-ink-300 text-center py-6">Ekstra maliyet eklenmemiş.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-brand-50 text-xs font-semibold text-ink-600 border-b border-brand-100">
                          <th className="px-4 py-2.5 text-left">Açıklama</th>
                          <th className="px-4 py-2.5 text-right">Tutar</th>
                          {costs && <th className="px-4 py-2.5 text-right">{product.currency} cinsinden</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {product.extraCosts.map((ec: any, idx: number) => (
                          <tr key={ec.id} className="hover:bg-ink-50/50">
                            <td className="px-4 py-2.5 text-ink-700">{ec.name}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-ink-600">{fmt2(ec.amount)} {ec.currency}</td>
                            {costs && (
                              <td className="px-4 py-2.5 text-right font-semibold text-brand-800">
                                {fmt2(costs.extraConverted[idx]?.converted ?? 0)} {product.currency}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      {costs && (
                        <tfoot>
                          <tr className="bg-brand-50 border-t-2 border-brand-200 font-bold">
                            <td className="px-4 py-2.5 text-brand-900 text-sm">TOPLAM</td>
                            <td></td>
                            <td className="px-4 py-2.5 text-right text-brand-800">{fmt2(costs.totalExtraCost)} {product.currency}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </div>
              )}
            </div>

          </div>}
        </div>
      </div>

      {/* Müşteri Özel Fiyatlar */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden mt-6 border border-ink-200/80">
        <div className="bg-ink-700 px-4 py-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-white" />
          <h2 className="text-white font-semibold text-sm">Müşteri Özel Fiyatlar</h2>
          <span className="text-ink-300 text-xs ml-auto">{productPrices.length} müşteri</span>
        </div>
        <div className="p-4 border-b border-ink-100">
          <div className="flex gap-2 flex-wrap">
            <select
              value={ppForm.customerId}
              onChange={e => setPpForm(f => ({ ...f, customerId: e.target.value }))}
              className="flex-1 min-w-[160px] px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
            >
              <option value="">— Müşteri Seç —</option>
              {allCustomers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={ppForm.unitPrice}
              onChange={e => setPpForm(f => ({ ...f, unitPrice: e.target.value }))}
              placeholder="Fiyat"
              className="w-28 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none"
            />
            <select
              value={ppForm.currency}
              onChange={e => setPpForm(f => ({ ...f, currency: e.target.value }))}
              className="w-24 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={handleAddProductPrice}
              disabled={ppSaving || !ppForm.customerId || !ppForm.unitPrice}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {ppSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Ekle / Güncelle
            </button>
          </div>
        </div>
        {productPrices.length === 0 ? (
          <div className="py-8 text-center text-ink-400 text-sm">Henüz özel fiyat eklenmemiş</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-500 font-medium border-b bg-ink-50">
                <th className="px-4 py-2 text-left">Müşteri</th>
                <th className="px-4 py-2 text-right">Katalog Fiyatı</th>
                <th className="px-4 py-2 text-right">Özel Fiyat</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {productPrices.map((pp: any) => (
                <tr key={pp.customerId} className="hover:bg-ink-50 group">
                  <td className="px-4 py-2.5 font-medium text-ink-800">{pp.customer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-ink-400 text-xs">
                    {product ? `${fmt2(product.unitPrice)} ${product.currency}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-brand-800">
                    {pp.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-normal text-ink-400 ml-1">{pp.currency}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button
                      onClick={() => handleDeleteProductPrice(pp.customerId)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Barkod Yazdır Modal */}
      {showBarcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowBarcode(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-ink-200/80">
            <div className="bg-brand-700 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <QrCode className="w-4 h-4" /> Barkod Etiket Yazdır
              </h3>
              <button onClick={() => setShowBarcode(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Firma Adı</label>
                  <input type="text" value={barcodeForm.companyName}
                    onChange={e => setBarcodeForm(f => ({ ...f, companyName: e.target.value }))}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Ürün Adı</label>
                  <input type="text" value={barcodeForm.productName}
                    onChange={e => setBarcodeForm(f => ({ ...f, productName: e.target.value }))}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Shore</label>
                <input type="text" value={barcodeForm.shore}
                  onChange={e => setBarcodeForm(f => ({ ...f, shore: e.target.value }))}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Tarih</label>
                <input type="text" value={barcodeForm.date}
                  onChange={e => setBarcodeForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Paket Miktarı</label>
                  <input type="text" inputMode="decimal" value={barcodeForm.qtyPerPack}
                    onChange={e => setBarcodeForm(f => ({ ...f, qtyPerPack: e.target.value }))}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Birim</label>
                  <select value={barcodeForm.qtyUnit} onChange={e => setBarcodeForm(f => ({ ...f, qtyUnit: e.target.value }))}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="adet">adet</option>
                    <option value="çift">çift</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Kaç Etiket</label>
                <DecimalInput min="1" value={barcodeForm.labelCount}
                  onChange={e => handleBarcodeLabelCountChange(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {barcodeNumbers.length > 0 && (
                <div className="bg-brand-50 rounded-xl px-4 py-3 text-xs text-brand-800">
                  <span className="font-medium">Barkod numaraları: </span>
                  {barcodeNumbers[0]}
                  {barcodeNumbers.length > 1 && ` → ${barcodeNumbers[barcodeNumbers.length - 1]}`}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={barcodeForm.addToStock}
                  onChange={e => setBarcodeForm(f => ({ ...f, addToStock: e.target.checked }))}
                  className="w-4 h-4 rounded accent-brand-700" />
                <span className="text-sm text-ink-600">Stoklara ekle</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowBarcode(false)}
                  className="flex-1 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">
                  Vazgeç
                </button>
                <button onClick={handlePrint} disabled={barcodeLoading}
                  className="flex-1 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {barcodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Yazdır
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showKoli && !isMaterial && product && (
        <KoliLabelModal
          items={[{ key: product.id, label: product.name, productId: product.id, productCode: product.code, productName: product.name, unit: product.unit, color: product.renk, sizes: product.sizes ?? [] }]}
          defaultAddToStock
          onClose={() => setShowKoli(false)}
          onPrinted={() => load()}
        />
      )}

      {/* Price Warning Modal */}
      {priceWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPriceWarning(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-ink-200/80">
            <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">⚠️ Fiyat Uyarısı</h3>
              <button onClick={() => setPriceWarning(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-ink-700 text-sm font-medium">
                Dikkat! Ürün satış fiyatı hesaplanan maliyet fiyatından düşük.
              </p>
              <div className="bg-red-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-500">Mevcut Satış Fiyatı</span>
                  <span className="font-semibold text-ink-700">{fmt2(product.unitPrice)} {product.currency}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold border-t border-red-200 pt-2">
                  <span>Hesaplanan Maliyet</span>
                  <span>{fmt2(priceWarning.totalCost)} {priceWarning.currency}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Yeni Satış Fiyatı ({product.currency})</label>
                <input
                  type="text" inputMode="decimal"
                  value={newPrice}
                  onChange={e => setNewPrice(normalizePriceInput(e.target.value))}
                  onKeyDown={blockDot}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPriceWarning(null)}
                  className="flex-1 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">
                  Vazgeç
                </button>
                <button onClick={handleUpdatePrice} disabled={updatingPrice || !newPrice}
                  className="flex-1 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {updatingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Fiyatı Güncelle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Material Modal */}
      {showMatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMatModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-ink-200/80">
            <div className="bg-brand-700 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Yeni Hammadde
              </h3>
              <button onClick={() => setShowMatModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Hammadde Adı *</label>
                <input
                  value={newMatForm.name}
                  onChange={e => setNewMatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ör. Deri Taban"
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink-500 mb-1">Kg Fiyatı *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newMatForm.pricePerKg}
                    onChange={e => setNewMatForm(f => ({ ...f, pricePerKg: normalizePriceInput(e.target.value) }))}
                    onKeyDown={blockDot}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Para Birimi</label>
                  <select
                    value={newMatForm.currency}
                    onChange={e => setNewMatForm(f => ({ ...f, currency: e.target.value }))}
                    className="px-3 py-2 border border-ink-200 rounded-lg text-sm bg-white outline-none"
                  >
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowMatModal(false)}
                  className="flex-1 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">
                  İptal
                </button>
                <button
                  onClick={handleNewMaterial}
                  disabled={savingMat || !newMatForm.name.trim() || !newMatForm.pricePerKg}
                  className="flex-1 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingMat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setErrorMsg('')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-800 mb-1">Hata</h3>
                <p className="text-sm text-ink-600">{errorMsg}</p>
              </div>
            </div>
            <button onClick={() => setErrorMsg('')}
              className="w-full py-2 bg-ink-700 hover:bg-ink-800 text-white rounded-lg text-sm font-medium">
              Tamam
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
