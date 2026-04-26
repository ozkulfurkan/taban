'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Loader2, Plus, Trash2, Pencil, X, ArrowLeft, Save, AlertTriangle, Info, CheckCircle, ChevronDown } from 'lucide-react';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';

interface LineItem {
  productId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  notes: string;
  partVariantsData?: Array<{ partId: string; materialId: string }>;
}

interface ModalState {
  open: boolean;
  editIndex: number | null;
}

const CURRENCIES = ['USD', 'EUR', 'TRY'];
const VAT_RATES = ['0', '1', '8', '10', '18', '20'];
const EMPTY_ITEM: LineItem = { description: '', quantity: '1', unitPrice: '', discount: '0', notes: '' };

function lineTotal(item: LineItem) {
  const qty = fromPriceInput(item.quantity);
  const price = fromPriceInput(item.unitPrice);
  const disc = fromPriceInput(item.discount);
  return qty * price * (1 - disc / 100);
}

// ── Line Item Modal ───────────────────────────────────────────────────────────
function ItemModal({ initial, currency, products, materials, customerPrices, onConfirm, onClose }: {
  initial: LineItem; currency: string; products: any[]; materials: any[];
  customerPrices?: Record<string, { unitPrice: number; currency: string }>;
  onConfirm: (item: LineItem) => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const [item, setItem] = useState<LineItem>({ ...initial });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [partMaterials, setPartMaterials] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initial.partVariantsData) {
      for (const pv of initial.partVariantsData) map[pv.partId] = pv.materialId;
    }
    return map;
  });
  const set = (field: keyof LineItem, val: string) => setItem(p => ({ ...p, [field]: val }));

  const handleProductSelect = (productId: string) => {
    if (!productId) { setSelectedProduct(null); setPartMaterials({}); return; }
    const p = products.find((p: any) => p.id === productId);
    if (!p) return;
    setSelectedProduct(p);
    const custPrice = customerPrices?.[productId];
    const unitPrice = custPrice
      ? toPriceInput(custPrice.unitPrice)
      : p.currency === currency ? toPriceInput(p.unitPrice) : '';
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
        <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">{item.description || t('newInvoice', 'product')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'selectFromCatalog')}</label>
              <select value={item.productId ?? ''} onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                <option value="">{t('newInvoice', 'manualEntry')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ${p.name}` : p.name}</option>)}
              </select>
            </div>
          )}
          {!item.productId && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'productName')}</label>
              <input value={item.description} onChange={e => set('description', e.target.value)} placeholder={t('newInvoice', 'enterDescription')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'qty')}</label>
              <input
                type="text"
                inputMode="decimal"
                value={item.quantity}
                onChange={e => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            {!(selectedProduct && (selectedProduct.parts ?? []).length > 0) && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'stockLabel')}</label>
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
          {/* Per-part material selection */}
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
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'unitPrice')}</label>
              <div className="flex">
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={e => set('unitPrice', normalizePriceInput(e.target.value))}
                  onKeyDown={blockDot}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0"
                />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs font-semibold text-slate-600 flex items-center">{currency}</span>
              </div>
              {selectedProduct && customerPrices?.[selectedProduct.id] && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ Özel fiyat: {customerPrices[selectedProduct.id].unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {customerPrices[selectedProduct.id].currency}
                </p>
              )}
              {selectedProduct && !customerPrices?.[selectedProduct.id] && selectedProduct.currency !== currency && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ Katalog fiyatı: {selectedProduct.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedProduct.currency}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'discount')}</label>
              <div className="flex">
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.discount}
                  onChange={e => set('discount', normalizePriceInput(e.target.value))}
                  onKeyDown={blockDot}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0"
                />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">%</span>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">{t('newInvoice', 'gross')}</span>
              <span className="text-sm text-slate-600">{gross.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500">{t('newInvoice', 'discountPct')}{disc})</span>
                <span className="text-sm text-red-500">-{discAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-amber-200 pt-2 mt-1">
              <span className="text-sm font-bold text-slate-700">{t('newInvoice', 'total')}</span>
              <span className="text-lg font-bold text-slate-800">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
            </div>
          </div>
          {/* Parts info */}
          {selectedProduct && (selectedProduct.parts ?? []).length === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Ürün parça ve gramaj bilgisi belli olmadığı için hammadde stoklarında değişiklik olmayacaktır.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'optionalNotes')}</label>
            <input value={item.notes} onChange={e => set('notes', e.target.value)} placeholder={t('newInvoice', 'enterDescription')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>
        {/* Sticky footer */}
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
            <Plus className="w-4 h-4" /> {t('common', 'add')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Currency Warning Modal ────────────────────────────────────────────────────
function CurrencyWarning({ invoiceCurrency, customerCurrency, onConfirm, onCancel }: {
  invoiceCurrency: string; customerCurrency: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Para Birimi Uyuşmuyor</h3>
        </div>
        <p className="text-sm text-slate-600 mb-1">
          Bu müşteri <strong className="text-slate-800">{customerCurrency}</strong> ile çalışıyor, siz <strong className="text-slate-800">{invoiceCurrency}</strong> seçtiniz.
        </p>
        <p className="text-xs text-slate-400 mb-5">Devam ederseniz fatura <strong>{invoiceCurrency}</strong> olarak kaydedilir.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Geri Dön
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
            {invoiceCurrency} ile Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stock Confirmation Modal ──────────────────────────────────────────────────
function StockConfirmModal({ deductions, onConfirm, onCancel, saving }: {
  deductions: { name: string; variantInfo: string; kgAmount: number; currentStock: number }[];
  onConfirm: () => void; onCancel: () => void; saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">Stok Düşümü Onayı</h3>
          <button onClick={onCancel} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {deductions.some(d => d.currentStock < d.kgAmount) && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">Bazı hammaddeler yetersiz — stok eksi değere düşecek.</p>
            </div>
          )}
          <p className="text-sm text-slate-600">
            Fatura kaydedildiğinde aşağıdaki hammaddeler stoğunuzdan otomatik düşülür.
            <span className="text-slate-400 block text-xs mt-0.5">Bu işlem geri alınamaz.</span>
          </p>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Hammadde</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Düşüm</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Mevcut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deductions.map((d, i) => (
                  <tr key={i} className={d.currentStock < d.kgAmount ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-700">{d.name}</p>
                      {d.variantInfo && <p className="text-xs text-slate-400">{d.variantInfo}</p>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600">−{d.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
                    <td className={`px-3 py-2 text-right font-medium ${d.currentStock < d.kgAmount ? 'text-red-600' : 'text-emerald-600'}`}>
                      {d.currentStock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Geri Dön
            </button>
            <button onClick={onConfirm} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Onayla ve Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    try { return localStorage.getItem('invoice_advanced') !== 'false'; } catch { return true; }
  });
  const [formErrors, setFormErrors] = useState<{ customerId?: string; items?: string }>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false, editIndex: null });
  const [draftItem, setDraftItem] = useState<LineItem>(EMPTY_ITEM);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [currencyWarning, setCurrencyWarning] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState('');
  const [stockConfirm, setStockConfirm] = useState<{ deductions: any[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const lockedCustomerId = searchParams?.get('customerId') ?? '';
  const prefillProductId = searchParams?.get('productId') ?? '';
  const prefillQuantity  = searchParams?.get('quantity')  ?? '';
  const orderId          = searchParams?.get('orderId')   ?? '';

  const [form, setForm] = useState(() => {
    const now = new Date();
    return {
      customerId: lockedCustomerId,
      invoiceNo: '',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      dueDate: '',
      irsaliyeNo: '',
      sevkTarihi: now.toISOString().split('T')[0],
      currency: 'USD',
      vatRate: '0',
      notes: '',
    };
  });

  const [items, setItems] = useState<LineItem[]>([]);
  const [customerPrices, setCustomerPrices] = useState<Record<string, { unitPrice: number; currency: string }>>({});

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => {
      const list: any[] = Array.isArray(d) ? d : (d.customers ?? []);
      setCustomers(list);
      // If lockedCustomerId not in loaded page, fetch it individually
      if (lockedCustomerId && !list.find((c: any) => c.id === lockedCustomerId)) {
        fetch(`/api/customers/${lockedCustomerId}`)
          .then(r => r.json())
          .then(c => { if (c?.id) setCustomers(prev => [{ id: c.id, name: c.name, currency: c.currency }, ...prev]); })
          .catch(console.error);
      }
    }).catch(console.error);
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(console.error);
    fetch('/api/materials').then(r => r.json()).then(d => setMaterials(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  // Pre-fill from orderId (Siparişler → Satışa Çevir)
  useEffect(() => {
    if (!orderId || products.length === 0 || items.length > 0) return;
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then((order: any) => {
        if (!order?.id || !order.productId) return;
        const product = products.find((p: any) => p.id === order.productId);
        setItems([{
          productId: order.productId,
          description: order.productCode || product?.name || '',
          quantity: String(order.totalQuantity || 1),
          unitPrice: product ? toPriceInput(product.unitPrice) : '',
          discount: '0',
          notes: '',
          partVariantsData: Array.isArray(order.partVariantsData) ? order.partVariantsData : undefined,
        }]);
      })
      .catch(console.error);
  }, [orderId, products]);

  // Pre-fill line item from URL params (e.g. coming from portal order "Satışa Çevir")
  useEffect(() => {
    if (!prefillProductId || products.length === 0 || items.length > 0) return;
    const product = products.find((p: any) => p.id === prefillProductId);
    if (!product) return;
    setItems([{
      productId: product.id,
      description: product.name,
      quantity: prefillQuantity || '1',
      unitPrice: toPriceInput(product.unitPrice),
      discount: '0',
      notes: '',
    }]);
  }, [products]);

  const setField = (field: string, val: string) => setForm(p => ({ ...p, [field]: val }));

  const filteredProducts = productSearch.length >= 2
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase())))
    : [];

  const selectedCustomer = customers.find(c => c.id === form.customerId);

  useEffect(() => {
    if (selectedCustomer?.currency) {
      setField('currency', selectedCustomer.currency);
    }
    if (form.customerId) {
      fetch(`/api/customers/${form.customerId}/prices`)
        .then(r => r.json())
        .then((d: any[]) => {
          if (!Array.isArray(d)) return;
          const map: Record<string, { unitPrice: number; currency: string }> = {};
          for (const p of d) map[p.productId] = { unitPrice: p.unitPrice, currency: p.currency };
          setCustomerPrices(map);
        })
        .catch(() => setCustomerPrices({}));
    } else {
      setCustomerPrices({});
    }
  }, [form.customerId, customers]); // customers bağımlılığı: async yüklenince de çalışsın

  const handleCurrencyChange = (val: string) => {
    if (selectedCustomer && val !== selectedCustomer.currency) {
      setPendingCurrency(val);
      setCurrencyWarning(true);
    } else {
      setField('currency', val);
    }
  };

  const openNewModal = (prefill?: Partial<LineItem>) => {
    setDraftItem({ ...EMPTY_ITEM, ...prefill });
    setModal({ open: true, editIndex: null });
  };

  const openEditModal = (idx: number) => {
    setDraftItem({ ...items[idx] });
    setModal({ open: true, editIndex: idx });
  };

  const handleModalConfirm = (item: LineItem) => {
    if (modal.editIndex !== null) {
      setItems(prev => prev.map((it, i) => i === modal.editIndex ? item : it));
    } else {
      setItems(prev => [...prev, item]);
      setFormErrors(p => ({ ...p, items: undefined }));
    }
    setModal({ open: false, editIndex: null });
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleProductClick = (product: any) => {
    setProductSearch('');
    setShowDropdown(false);
    openNewModal({ productId: product.id, description: product.name, unitPrice: toPriceInput(product.unitPrice) });
  };

  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const vatRate = parseFloat(form.vatRate) || 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const performSave = async () => {
    setSaving(true);
    try {
      const dateTimeIso = new Date(`${form.date}T${form.time}`).toISOString();
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, date: dateTimeIso, items }),
      });
      const data = await res.json();
      if (data.id) {
        setStockConfirm(null);
        if (orderId) {
          await fetch(`/api/orders/${orderId}/mark-converted`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: data.id }),
          }).catch(console.error);
        }
        router.push(form.customerId ? `/customers/${form.customerId}` : `/invoices/${data.id}`);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSubmit = () => {
    const errors: { customerId?: string; items?: string } = {};
    if (!form.customerId) errors.customerId = t('newInvoice', 'selectCustomer');
    if (items.length === 0) errors.items = t('newInvoice', 'noItems');
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});

    // Check if any item has a product with parts defined
    const deductionMap = new Map<string, { name: string; variantInfo: string; kgAmount: number; currentStock: number }>();
    let hasAnyParts = false;

    for (const item of items) {
      if (!item.productId) continue;
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.parts || product.parts.length === 0) continue;
      hasAnyParts = true;
      const qty = fromPriceInput(item.quantity);

      for (const part of product.parts) {
        // Use user-selected material if available, otherwise fall back to part default
        const selectedMatId = item.partVariantsData?.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
        if (!selectedMatId) continue;
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * qty) / 1000;
        const key = selectedMatId;
        const mat = materials.find(m => m.id === selectedMatId);
        const matName = mat?.name ?? part.material?.name ?? '—';
        const currentStock = mat?.stock ?? part.material?.stock ?? 0;

        const existing = deductionMap.get(key);
        if (existing) {
          existing.kgAmount += kgUsed;
        } else {
          deductionMap.set(key, { name: matName, variantInfo: part.name, kgAmount: kgUsed, currentStock });
        }
      }
    }

    if (hasAnyParts && deductionMap.size > 0) {
      setStockConfirm({ deductions: Array.from(deductionMap.values()) });
    } else {
      performSave();
    }
  };

  return (
    <AppShell>
      <div className="space-y-3 h-full">
        {/* Top action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('common', 'back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? t('newInvoice', 'saving') : t('newInvoice', 'save')}
          </button>
        </div>

        {/* Split Layout */}
        <div className="flex gap-4 items-start flex-col">
          {/* LEFT PANEL */}
          <div className="w-full bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-4 py-3">
              <p className="text-white font-semibold text-sm truncate">
                {selectedCustomer?.name || t('newInvoice', 'noCustomer')}
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'customer')} *</label>
                {lockedCustomerId ? (
                  <div className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-700 font-medium">
                    {selectedCustomer?.name || lockedCustomerId}
                  </div>
                ) : (
                  <select required value={form.customerId}
                    onChange={e => { setField('customerId', e.target.value); setFormErrors(p => ({ ...p, customerId: undefined })); }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white ${formErrors.customerId ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'}`}>
                    <option value="">{t('newInvoice', 'selectCustomerPlaceholder')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {formErrors.customerId && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />{formErrors.customerId}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'invoiceNo')}</label>
                <input value={form.invoiceNo} onChange={e => setField('invoiceNo', e.target.value)} placeholder={t('newInvoice', 'autoGenerated')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'date')}</label>
                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'currency')}</label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm">
                    <span className="font-semibold text-slate-700">{selectedCustomer.currency}</span>
                    <span className="text-xs text-slate-400">(müşteri para birimi)</span>
                  </div>
                ) : (
                  <select
                    value={form.currency}
                    onChange={e => setField('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !showAdvanced;
                  setShowAdvanced(next);
                  try { localStorage.setItem('invoice_advanced', String(next)); } catch {}
                }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium py-0.5"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Gelişmiş Seçenekler
              </button>
              {showAdvanced && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Saat</label>
                    <input type="time" value={form.time} onChange={e => setField('time', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'dueDate')}</label>
                    <input type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'irsaliyeNo')}</label>
                    <input value={form.irsaliyeNo} onChange={e => setField('irsaliyeNo', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'shippingDate')}</label>
                    <input type="date" value={form.sevkTarihi} onChange={e => setField('sevkTarihi', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'notes')}</label>
                    <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-green-600 px-4 py-3">
              <p className="text-white font-semibold text-sm uppercase tracking-wide">{t('newInvoice', 'productsTitle')}</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Product search */}
              <div className="relative">
                <input
                  ref={searchRef}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder={t('newInvoice', 'searchProducts')}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-green-500 rounded-lg text-sm outline-none"
                />
                {showDropdown && productSearch.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">{t('common', 'noResults')}</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => handleProductClick(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-500 hover:text-white text-sm transition-colors text-left"
                        >
                          <span className="font-medium">{p.name}{p.code ? <span className="ml-1.5 text-xs font-normal opacity-60">{p.code}</span> : null}</span>
                          <span className="text-xs opacity-70 ml-2 flex-shrink-0">{p.stock} {p.unit}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {showDropdown && productSearch.length > 0 && productSearch.length < 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-md z-10">
                    <div className="px-4 py-3 text-sm text-slate-400">{t('newInvoice', 'typeMoreChars')}</div>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => openNewModal()}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus className="w-4 h-4" /> {t('newInvoice', 'manualAddItem')}
              </button>

              {/* Items table */}
              {items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 font-medium border-b">
                        <th className="text-left pb-2">{t('newInvoice', 'product')}</th>
                        <th className="text-right pb-2 px-2 w-20">{t('newInvoice', 'qty')}</th>
                        <th className="text-right pb-2 px-2 w-28">{t('newInvoice', 'unitPrice')}</th>
                        <th className="text-right pb-2 px-2 w-16">{t('newInvoice', 'discount')}</th>
                        <th className="text-right pb-2 w-28">{t('common', 'total')}</th>
                        <th className="w-14"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 pr-2">
                            <p className="font-medium text-slate-800">{item.description}</p>
                            {item.productId && (() => {
                              const prod = products.find(p => p.id === item.productId);
                              const parts = prod?.parts ?? [];
                              if (parts.length === 0) return <p className="text-xs text-amber-500">⚠ Parça bilgisi yok</p>;
                              return <p className="text-xs text-purple-600">{parts.map((p: any) => p.name).join(', ')}</p>;
                            })()}
                            {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-600">{item.quantity}</td>
                          <td className="py-2 px-2 text-right text-slate-600">
                            {fromPriceInput(item.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {parseFloat(item.discount) > 0 ? `%${item.discount}` : '—'}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {lineTotal(item).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 pl-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button type="button" onClick={() => openEditModal(i)} className="p-1 text-slate-300 hover:text-blue-500 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => removeItem(i)} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">{t('newInvoice', 'vatRate')}</span>
                    <select value={form.vatRate} onChange={e => setField('vatRate', e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-24">
                      {VAT_RATES.map(r => <option key={r} value={r}>%{r}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{t('newInvoice', 'subtotal')}</span>
                    <span>{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.currency}</span>
                  </div>
                  {vatRate > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>{t('newInvoice', 'vatAmount')} (%{vatRate})</span>
                      <span>{vatAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-800 border-t pt-2">
                    <span>{t('newInvoice', 'grandTotal')}</span>
                    <span>{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.currency}</span>
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <div className={`text-center py-10 border-2 border-dashed rounded-xl text-sm ${formErrors.items ? 'border-red-300 bg-red-50 text-red-400' : 'border-slate-200 text-slate-400'}`}>
                  {formErrors.items ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />{formErrors.items}
                    </span>
                  ) : t('newInvoice', 'emptyItemsHint')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Modal */}
      {modal.open && (
        <ItemModal
          initial={draftItem}
          currency={form.currency}
          products={products}
          materials={materials}
          customerPrices={customerPrices}
          onConfirm={handleModalConfirm}
          onClose={() => setModal({ open: false, editIndex: null })}
        />
      )}

      {/* Currency Warning */}
      {currencyWarning && (
        <CurrencyWarning
          invoiceCurrency={pendingCurrency}
          customerCurrency={selectedCustomer?.currency || ''}
          onConfirm={() => { setField('currency', pendingCurrency); setCurrencyWarning(false); }}
          onCancel={() => { setCurrencyWarning(false); }}
        />
      )}
      {stockConfirm && (
        <StockConfirmModal
          deductions={stockConfirm.deductions}
          onConfirm={performSave}
          onCancel={() => setStockConfirm(null)}
          saving={saving}
        />
      )}
    </AppShell>
  );
}
