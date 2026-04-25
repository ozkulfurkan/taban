'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import { formatDate, toDateInputValue } from '@/lib/time';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';
import {
  Loader2, Printer, Pencil, X, CreditCard, User,
  Plus, Trash2, Save, ChevronLeft, Package, CheckCircle, ChevronDown, ChevronRight, Layers, Search,
} from 'lucide-react';

interface EditLineItem {
  productId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  notes: string;
  partVariantsData?: Array<{ partId: string; materialId: string }>;
}

function ItemModal({ initial, currency, products, materials, onConfirm, onClose }: {
  initial: EditLineItem; currency: string; products: any[]; materials: any[];
  onConfirm: (item: EditLineItem) => void; onClose: () => void;
}) {
  const [item, setItem] = useState<EditLineItem>({ ...initial });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [partMaterials, setPartMaterials] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initial.partVariantsData) {
      for (const pv of initial.partVariantsData) map[pv.partId] = pv.materialId;
    }
    return map;
  });
  const set = (field: keyof EditLineItem, val: string) => setItem(p => ({ ...p, [field]: val }));

  const handleProductSelect = (productId: string) => {
    if (!productId) { setSelectedProduct(null); setPartMaterials({}); return; }
    const p = products.find((p: any) => p.id === productId);
    if (!p) return;
    setSelectedProduct(p);
    const unitPrice = p.currency === currency ? toPriceInput(p.unitPrice) : '';
    setItem(prev => ({ ...prev, productId: p.id, description: p.name, unitPrice }));
    const defaults: Record<string, string> = {};
    for (const part of (p.parts ?? [])) {
      if (part.materialId) defaults[part.id] = part.materialId;
    }
    setPartMaterials(defaults);
  };

  useEffect(() => {
    if (initial.productId && !selectedProduct) {
      const p = products.find((p: any) => p.id === initial.productId);
      if (p) {
        setSelectedProduct(p);
        if (!initial.partVariantsData || initial.partVariantsData.length === 0) {
          const defaults: Record<string, string> = {};
          for (const part of (p.parts ?? [])) {
            if (part.materialId) defaults[part.id] = part.materialId;
          }
          setPartMaterials(defaults);
        }
      }
    }
  }, []);

  const qty = fromPriceInput(item.quantity);
  const price = fromPriceInput(item.unitPrice);
  const disc = fromPriceInput(item.discount);
  const gross = qty * price;
  const discAmount = gross * disc / 100;
  const total = gross - discAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="bg-emerald-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">{item.description || 'Ürün / Hizmet'}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Kataloğundan Seç</label>
              <select value={item.productId ?? ''} onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                <option value="">Manuel Giriş</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ${p.name}` : p.name}</option>)}
              </select>
            </div>
          )}
          {!item.productId && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Adı</label>
              <input value={item.description} onChange={e => set('description', e.target.value)} placeholder="Açıklama girin"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Miktar</label>
              <input type="text" inputMode="decimal" value={item.quantity}
                onChange={e => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            {!(selectedProduct && (selectedProduct.parts ?? []).length > 0) && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Stok</label>
                <div className={`px-3 py-2 border rounded-lg text-sm ${
                  selectedProduct
                    ? selectedProduct.stock <= 0
                      ? 'bg-red-50 border-red-200 text-red-600 font-medium'
                      : 'bg-green-50 border-green-200 text-green-700 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {selectedProduct ? `${selectedProduct.stock} ${selectedProduct.unit}` : '—'}
                </div>
              </div>
            )}
          </div>
          {selectedProduct && (selectedProduct.parts ?? []).length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Hammadde Seçimi</label>
              {(selectedProduct.parts as any[]).map((part: any) => {
                const selectedMatId = partMaterials[part.id] ?? '';
                const selectedMat = materials.find(m => m.id === selectedMatId);
                const stock = selectedMat?.stock ?? part.material?.stock ?? null;
                return (
                  <div key={part.id} className="flex items-center gap-2">
                    <span className="w-24 flex-shrink-0 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1.5 rounded-lg text-center truncate">{part.name}</span>
                    <select
                      value={selectedMatId}
                      onChange={e => setPartMaterials(prev => ({ ...prev, [part.id]: e.target.value }))}
                      className="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      <option value="">— Seç —</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <div className={`w-24 flex-shrink-0 px-2 py-1.5 border rounded-lg text-xs text-right ${
                      stock === null ? 'bg-slate-50 border-slate-200 text-slate-400' :
                      stock <= 0 ? 'bg-red-50 border-red-200 text-red-600 font-medium' :
                      'bg-green-50 border-green-200 text-green-700 font-medium'
                    }`}>
                      {stock !== null ? `${stock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Birim Fiyat</label>
              <div className="flex">
                <input type="text" inputMode="decimal" value={item.unitPrice}
                  onChange={e => set('unitPrice', normalizePriceInput(e.target.value))}
                  onKeyDown={blockDot}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0" />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs font-semibold text-slate-600 flex items-center">{currency}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">İndirim (%)</label>
              <div className="flex">
                <input type="text" inputMode="decimal" value={item.discount}
                  onChange={e => set('discount', normalizePriceInput(e.target.value))}
                  onKeyDown={blockDot}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0" />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">%</span>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">Brüt</span>
              <span className="text-sm text-slate-600">{gross.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
            </div>
            <div className="flex justify-between items-center border-t border-amber-200 pt-2 mt-1">
              <span className="text-sm font-bold text-slate-700">TOPLAM</span>
              <span className="text-lg font-bold text-slate-800">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama (isteğe bağlı)</label>
            <input value={item.notes} onChange={e => set('notes', e.target.value)} placeholder="Açıklama girin"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>
        <div className="px-5 pb-4 pt-3 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={() => {
            if (item.description || item.unitPrice) {
              const pvd = Object.entries(partMaterials)
                .filter(([, matId]) => matId)
                .map(([partId, materialId]) => ({ partId, materialId }));
              onConfirm({ ...item, partVariantsData: pvd.length > 0 ? pvd : undefined });
            }
          }}
            disabled={!item.description && !item.unitPrice}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Güncelle
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;
const toInput = (d: string | Date | null) => toDateInputValue(d);

const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı', 'POS'];

function emptyItem(): EditLineItem {
  return { description: '', quantity: '1', unitPrice: '', discount: '0', notes: '' };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [itemModal, setItemModal] = useState<{ open: boolean; editIndex: number | null }>({ open: false, editIndex: null });
  const [draftItem, setDraftItem] = useState<EditLineItem>(emptyItem());

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});
  const [editItems, setEditItems] = useState<EditLineItem[]>([]);

  // Payment form state
  const [payForm, setPayForm] = useState({
    amount: '', method: 'Nakit', date: toDateInputValue(), notes: '',
  });

  // Expand edilmiş item satırları (ürün bileşenlerini göstermek için)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleItem = (id: string) => setExpandedItems(p => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Stok düşümü state
  const [showStokModal, setShowStokModal] = useState(false);
  const [stokData, setStokData] = useState<any>(null);
  const [stokLoading, setStokLoading] = useState(false);
  const [stokSaving, setStokSaving] = useState(false);
  const [stokAdjustments, setStokAdjustments] = useState<any[]>([]);

  const handleStokOpen = async () => {
    setStokLoading(true);
    setShowStokModal(true);
    try {
      const res = await fetch(`/api/invoices/${params.id}/stok-dusumu`);
      const data = await res.json();
      setStokData(data);
      setStokAdjustments((data.adjustments || []).map((a: any) => ({ ...a, kgInput: String(a.kgAmount) })));
    } finally { setStokLoading(false); }
  };

  const handleStokOnayla = async () => {
    setStokSaving(true);
    try {
      await fetch(`/api/invoices/${params.id}/stok-dusumu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustments: stokAdjustments.map(a => ({
            materialId: a.materialId,
            kgAmount: parseFloat(a.kgInput) || 0,
          })),
        }),
      });
      setShowStokModal(false);
      load();
    } finally { setStokSaving(false); }
  };

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.error) {
          setInvoice(d);
          setEditForm({
            invoiceNo: d.invoiceNo || '',
            date: toInput(d.date),
            dueDate: toInput(d.dueDate),
            currency: d.currency || 'TRY',
            vatRate: String(d.vatRate ?? 0),
            notes: d.notes || '',
          });
          setEditItems((d.items || []).map((i: any) => ({
            productId: i.productId || undefined,
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: String(i.unitPrice),
            discount: String(i.discount ?? 0),
            notes: i.notes || '',
            partVariantsData: Array.isArray(i.partVariantsData) && i.partVariantsData.length > 0
              ? i.partVariantsData
              : undefined,
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/materials').then(r => r.json()).then(d => setMaterials(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Compute preview totals from editItems
  const previewTotals = editItems.reduce((acc, i) => {
    const qty = parseFloat(i.quantity) || 0;
    const price = parseFloat(i.unitPrice) || 0;
    const disc = parseFloat(i.discount) || 0;
    const tutar = qty * price;
    const indirimTL = tutar * disc / 100;
    const net = tutar - indirimTL;
    return {
      totalQty: acc.totalQty + qty,
      brut: acc.brut + tutar,
      indirim: acc.indirim + indirimTL,
      net: acc.net + net,
    };
  }, { totalQty: 0, brut: 0, indirim: 0, net: 0 });
  const vatRate = parseFloat(editForm.vatRate) || (invoice?.vatRate ?? 0);
  const kdvAmount = previewTotals.net * vatRate / 100;
  const toplam = previewTotals.net + kdvAmount;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          vatRate: parseFloat(editForm.vatRate) || 0,
          items: editItems.map(i => ({
            productId: i.productId || null,
            description: i.description,
            quantity: parseFloat(i.quantity) || 0,
            unitPrice: parseFloat(i.unitPrice) || 0,
            discount: parseFloat(i.discount) || 0,
            notes: i.notes || null,
            partVariantsData: i.partVariantsData || null,
          })),
        }),
      });
      const updated = await res.json();
      setInvoice(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Bu fatura silinecek. Bağlı ödemeler de silinir.\n\n⚠️ Uyarı: Bu faturaya bağlı tüm stok hareketleri (ürün ve hammadde stokları) geri alınacaktır.\n\nEmin misiniz?')) return;
    setDeleting(true);
    await fetch(`/api/invoices/${params.id}`, { method: 'DELETE' });
    router.back();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return;
    setPayLoading(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: payForm.amount,
          currency: invoice.currency,
          date: payForm.date,
          method: payForm.method,
          notes: payForm.notes,
        }),
      });
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'Nakit', date: toDateInputValue(), notes: '' });
      load();
    } finally { setPayLoading(false); }
  };

  const addItem = () => {
    setDraftItem(emptyItem());
    setItemModal({ open: true, editIndex: null });
  };

  const filteredSearchProducts = productSearch.length >= 2
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase()))
      )
    : [];

  const handleSearchProductClick = (product: any) => {
    setProductSearch('');
    setShowSearchDropdown(false);
    setDraftItem({ ...emptyItem(), productId: product.id, description: product.name, unitPrice: toPriceInput(product.unitPrice) });
    setItemModal({ open: true, editIndex: null });
  };
  const openEditItemModal = (idx: number) => {
    setDraftItem({ ...editItems[idx] });
    setItemModal({ open: true, editIndex: idx });
  };
  const handleItemModalConfirm = (item: EditLineItem) => {
    if (itemModal.editIndex !== null) {
      setEditItems(prev => prev.map((it, i) => i === itemModal.editIndex ? item : it));
    } else {
      setEditItems(prev => [...prev, item]);
    }
    setItemModal({ open: false, editIndex: null });
  };
  const removeItem = (i: number) => setEditItems(p => p.filter((_, idx) => idx !== i));

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></AppShell>;
  if (!invoice) return <AppShell><div className="text-center py-16 text-slate-400">Fatura bulunamadı</div></AppShell>;

  const remaining = invoice.total - invoice.paidAmount;

  // Computed display values from invoice items
  const displayTotals = (invoice.items || []).reduce((acc: any, i: any) => {
    const tutar = i.quantity * i.unitPrice;
    const indirimTL = tutar * (i.discount ?? 0) / 100;
    const net = tutar - indirimTL;
    return { totalQty: acc.totalQty + i.quantity, brut: acc.brut + tutar, indirim: acc.indirim + indirimTL, net: acc.net + net };
  }, { totalQty: 0, brut: 0, indirim: 0, net: 0 });

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm">
          <ChevronLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            const { default: jsPDF } = require('jspdf'); void handlePdf(invoice);
          }}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Yazdır
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
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            <X className="w-4 h-4" /> İptal Et
          </button>
          <button onClick={() => setShowPayForm(s => !s)}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
            <CreditCard className="w-4 h-4" /> Tahsilat Gir
          </button>
          <Link href={`/customers/${invoice.customerId}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 text-white rounded-lg text-sm font-medium">
            <User className="w-4 h-4" /> Müşteri Sayfası
          </Link>
          {/* Stok düşümü butonu */}
          {(invoice.items || []).some((i: any) => i.productId) && (
            invoice.stockDeducted ? (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> Stok Düşümü Yapıldı
              </span>
            ) : (
              <button onClick={handleStokOpen}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
                <Package className="w-4 h-4" /> Stok Düşümünü Onayla
              </button>
            )
          )}
        </div>

        {/* Payment form inline */}
        {showPayForm && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <form onSubmit={handlePayment} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Tutar</label>
                <input required type="number" step="0.01" value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Kalan: ${fmt(remaining)}`}
                  className="w-36 px-3 py-2 border border-green-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Yöntem</label>
                <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}
                  className="px-3 py-2 border border-green-300 rounded-lg text-sm outline-none bg-white">
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Tarih</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                  className="px-3 py-2 border border-green-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-green-700 mb-1">Not</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm outline-none" />
              </div>
              <button type="submit" disabled={payLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Kaydet
              </button>
              <button type="button" onClick={() => setShowPayForm(false)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                İptal
              </button>
            </form>
          </div>
        )}

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Customer info + Invoice meta */}
          <div className="space-y-3">
            {/* Customer header */}
            <div className="bg-blue-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{invoice.customer?.name}</p>
                {invoice.customer?.taxId && <p className="text-blue-200 text-xs mt-0.5">VKN: {invoice.customer.taxId}</p>}
              </div>
              <User className="w-5 h-5 text-blue-300" />
            </div>

            {/* Invoice meta card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {editing && (
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">Düzenleme modu aktif</p>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Belge No', field: 'invoiceNo', type: 'text', value: invoice.invoiceNo },
                  { label: 'Tarihi', field: 'date', type: 'date', value: fmtDate(invoice.date) },
                  { label: 'Vadesi', field: 'dueDate', type: 'date', value: invoice.dueDate ? fmtDate(invoice.dueDate) : '—' },
                  { label: 'Para Birimi', field: 'currency', type: 'select', value: invoice.currency },
                  { label: 'KDV Oranı', field: 'vatRate', type: 'number', value: `%${invoice.vatRate}` },
                ].map(row => (
                  <div key={row.field} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    {editing ? (
                      row.type === 'select' ? (
                        <select value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input type={row.type} value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                      )
                    ) : (
                      <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                    )}
                  </div>
                ))}
                {/* Notes */}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Açıklama</span>
                  {editing ? (
                    <textarea value={editForm.notes || ''} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  ) : (
                    <p className="text-sm text-slate-600">{invoice.notes || <span className="text-slate-300 italic">—</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment summary */}
            {invoice.payments?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Tahsilat Geçmişi</p>
                <div className="space-y-2">
                  {invoice.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-slate-500">{fmtDate(p.date)} — {p.method}</span>
                      <span className="font-semibold text-green-600">+{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-500 pt-2 border-t">
                      <span>Kalan</span>
                      <span>{fmt(remaining)} {invoice.currency}</span>
                    </div>
                  )}
                  {remaining <= 0 && (
                    <div className="text-center text-xs text-green-600 font-semibold pt-1">Tümü Tahsil Edildi ✓</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Items + Totals */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-green-600 px-4 py-3 flex items-center justify-between">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Ürün / Hizmetler</h2>
                {editing && (
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" /> Manuel Ekle
                  </button>
                )}
              </div>

              {/* Product search box — only in edit mode */}
              {editing && (
                <div className="px-4 py-3 border-b border-slate-100 relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={e => { setProductSearch(e.target.value); setShowSearchDropdown(true); }}
                      onFocus={() => setShowSearchDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
                      placeholder="Ürün isminden veya kodundan arayın..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                    {showSearchDropdown && productSearch.length >= 2 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                        {filteredSearchProducts.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-400">Sonuç bulunamadı</div>
                        ) : (
                          filteredSearchProducts.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={() => handleSearchProductClick(p)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-green-500 hover:text-white text-sm transition-colors text-left"
                            >
                              <span className="font-medium">
                                {p.name}
                                {p.code && <span className="ml-2 text-xs opacity-60">{p.code}</span>}
                              </span>
                              <span className="text-xs opacity-70 ml-2 flex-shrink-0">{p.stock} {p.unit}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {showSearchDropdown && productSearch.length > 0 && productSearch.length < 2 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-md z-20">
                        <div className="px-4 py-3 text-sm text-slate-400">En az 2 karakter girin</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-green-50 text-xs font-semibold text-slate-600 border-b border-green-100">
                      <th className="px-3 py-2.5 text-left w-8">#</th>
                      <th className="px-3 py-2.5 text-left">Açıklama</th>
                      <th className="px-3 py-2.5 text-right">Miktar</th>
                      <th className="px-3 py-2.5 text-right">Fiyat</th>
                      <th className="px-3 py-2.5 text-right">Tutar</th>
                      <th className="px-3 py-2.5 text-right">İndirim</th>
                      <th className="px-3 py-2.5 text-right">Net</th>
                      <th className="px-3 py-2.5 text-right">KDV</th>
                      {editing && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {editing ? editItems.map((item, idx) => {
                      const qty = fromPriceInput(item.quantity);
                      const price = fromPriceInput(item.unitPrice);
                      const disc = fromPriceInput(item.discount);
                      const tutar = qty * price;
                      const indirimTL = tutar * disc / 100;
                      const net = tutar - indirimTL;
                      const kdv = net * vatRate / 100;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-700 text-sm">{item.description}</p>
                            {item.partVariantsData && item.partVariantsData.length > 0 && (
                              <p className="text-xs text-purple-600">
                                {item.partVariantsData.map(pv => {
                                  const mat = materials.find(m => m.id === pv.materialId);
                                  return mat?.name;
                                }).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600 text-sm">{qty.toLocaleString('tr-TR')}</td>
                          <td className="px-3 py-2 text-right text-slate-600 text-sm">{fmt(price)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmt(tutar)}</td>
                          <td className="px-3 py-2 text-right text-slate-500 text-sm">{disc > 0 ? `%${disc}` : '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-700 font-medium">{fmt(net)}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{fmt(kdv)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEditItemModal(idx)} className="p-1 text-slate-400 hover:text-blue-600" title="Düzenle">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600" title="Sil">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (invoice.items || []).map((item: any, idx: number) => {
                      const tutar = item.quantity * item.unitPrice;
                      const indirimTL = tutar * (item.discount ?? 0) / 100;
                      const net = tutar - indirimTL;
                      const kdv = net * invoice.vatRate / 100;
                      const parts = item.product?.parts ?? [];
                      const isExpanded = expandedItems.has(item.id);
                      return (
                        <>
                          <tr key={item.id} className={`hover:bg-slate-50/50 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-3 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5 text-slate-700">
                              <div className="flex items-center gap-1.5">
                                {parts.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleItem(item.id)}
                                    className="flex-shrink-0 p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                                    title="Ürün bileşenlerini göster"
                                  >
                                    {isExpanded
                                      ? <ChevronDown className="w-3.5 h-3.5" />
                                      : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                                <span>{item.description}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{item.quantity.toLocaleString('tr-TR')}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{fmt(item.unitPrice)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{fmt(tutar)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-500">{fmt(indirimTL)}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-slate-700">{fmt(net)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-500">{fmt(kdv)}</td>
                          </tr>
                          {isExpanded && parts.length > 0 && (
                            <tr key={`${item.id}-parts`} className="bg-blue-50/40">
                              <td></td>
                              <td colSpan={7} className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Ürün Bileşenleri</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {parts.map((part: any) => {
                                    const matName = part.material?.name ?? null;
                                    return (
                                      <div key={part.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs shadow-sm">
                                        <span className="font-semibold text-slate-700">{part.name}</span>
                                        {matName && (
                                          <>
                                            <span className="text-slate-400">-</span>
                                            <span className="text-slate-500">{matName}</span>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals summary */}
              <div className="px-4 py-4 border-t border-slate-100">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-sm">
                    {(() => {
                      const t = editing ? previewTotals : displayTotals;
                      const vr = editing ? vatRate : invoice.vatRate;
                      const kdv = t.net * vr / 100;
                      const total = t.net + kdv;
                      return (
                        <>
                          <div className="flex justify-between text-slate-500">
                            <span>Toplam Miktar</span>
                            <span>{t.totalQty.toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Brüt Toplam</span>
                            <span>{fmt(t.brut)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>İndirim</span>
                            <span>{fmt(t.indirim)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Net Toplam</span>
                            <span>{fmt(t.net)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>KDV (%{vr})</span>
                            <span>{fmt(kdv)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-800 text-base pt-2 border-t">
                            <span>TOPLAM</span>
                            <span>{fmt(editing ? total : invoice.total)} {editForm.currency || invoice.currency}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kalem Düzenleme Modalı */}
      {itemModal.open && (
        <ItemModal
          initial={draftItem}
          currency={editForm.currency || invoice?.currency || 'USD'}
          products={products}
          materials={materials}
          onConfirm={handleItemModalConfirm}
          onClose={() => setItemModal({ open: false, editIndex: null })}
        />
      )}

      {/* Stok Düşümü Modalı */}
      {showStokModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowStokModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="bg-amber-500 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <Package className="w-5 h-5" /> Hammadde Stok Düşümü
              </h3>
              <button onClick={() => setShowStokModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {stokLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
              ) : stokAdjustments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Bu faturada ürün kataloğundan seçilmiş kalem bulunamadı.
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    Aşağıdaki miktarlar ürün reçetesine göre hesaplandı. Düzenleyebilirsiniz.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                          <th className="px-3 py-2 text-left">Hammadde</th>
                          <th className="px-3 py-2 text-right">Mevcut Stok (kg)</th>
                          <th className="px-3 py-2 text-right">Hesaplanan (kg)</th>
                          <th className="px-3 py-2 text-right">Düşülecek (kg)</th>
                          <th className="px-3 py-2 text-right">Sonraki Stok (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stokAdjustments.map((adj: any, idx: number) => {
                          const dusulecek = parseFloat(adj.kgInput) || 0;
                          const sonraki = adj.currentStock - dusulecek;
                          return (
                            <tr key={adj.materialId} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2.5 font-medium text-slate-700">{adj.name}</td>
                              <td className="px-3 py-2.5 text-right text-slate-500">
                                {adj.currentStock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-400 text-xs">
                                {adj.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number" step="0.001" min="0"
                                  value={adj.kgInput}
                                  onChange={e => setStokAdjustments(p => p.map((a, i) => i === idx ? { ...a, kgInput: e.target.value } : a))}
                                  className="w-28 px-2 py-1 border border-amber-300 rounded text-sm text-right outline-none focus:ring-2 focus:ring-amber-400"
                                />
                              </td>
                              <td className={`px-3 py-2.5 text-right font-semibold ${sonraki < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                {sonraki.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {stokAdjustments.some(a => (a.currentStock - (parseFloat(a.kgInput) || 0)) < 0) && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                      ⚠ Bazı hammaddeler için stok yetersiz. Yine de kaydedebilirsiniz (stok negatife düşer).
                    </div>
                  )}
                  <div className="flex justify-end gap-3 mt-5">
                    <button onClick={() => setShowStokModal(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                      Vazgeç
                    </button>
                    <button onClick={handleStokOnayla} disabled={stokSaving}
                      className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                      {stokSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                      Onayla ve Düşür
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

async function handlePdf(invoice: any) {
  const { default: jsPDF } = await import('jspdf');
  const tr = (s: string) => (s || '').replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
    .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C');
  const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; let y = M;
  doc.setFillColor(37,99,235); doc.rect(0,0,W,24,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('FATURA', M, 11);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(tr(invoice.invoiceNo), M, 19);
  doc.text(tr(invoice.customer?.name ?? ''), W-M, 11, { align: 'right' });
  doc.text(new Date(invoice.date).toLocaleDateString('tr-TR'), W-M, 19, { align: 'right' });
  y = 34;
  doc.setTextColor(30,30,30); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.setFillColor(241,245,249); doc.rect(M, y-3, W-2*M, 7, 'F');
  const cols = [8,60,18,22,22,18,22,22];
  const headers = ['#','Aciklama','Miktar','Fiyat','Tutar','Indirim','Net','KDV'];
  let x = M;
  headers.forEach((h,i) => { doc.text(h, x+1, y); x += cols[i]; }); y += 6;
  doc.setFont('helvetica','normal');
  (invoice.items||[]).forEach((item: any, idx: number) => {
    if (y > 260) { doc.addPage(); y = 15; }
    const tutar = item.quantity * item.unitPrice;
    const indirim = tutar * (item.discount??0)/100;
    const net = tutar - indirim;
    const kdv = net * invoice.vatRate / 100;
    x = M;
    [String(idx+1), tr(item.description).substring(0,30), String(item.quantity),
      fmt2(item.unitPrice), fmt2(tutar), fmt2(indirim), fmt2(net), fmt2(kdv)
    ].forEach((v,i) => { doc.text(v, x+1, y); x += cols[i]; });
    doc.setDrawColor(230,230,230); doc.line(M, y+2, W-M, y+2); y += 6;
  });
  y += 4; doc.setFont('helvetica','bold');
  doc.text(`Net Toplam: ${fmt2(invoice.subtotal)}   KDV (%${invoice.vatRate}): ${fmt2(invoice.vatAmount)}   TOPLAM: ${fmt2(invoice.total)} ${invoice.currency}`, M, y);
  doc.save(`${tr(invoice.invoiceNo)}.pdf`);
}
