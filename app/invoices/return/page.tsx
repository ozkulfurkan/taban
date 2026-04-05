'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDate, toDateInputValue } from '@/lib/time';
import { Loader2, Plus, Trash2, Pencil, X, ArrowLeft, Save, AlertTriangle, RotateCcw } from 'lucide-react';

interface LineItem {
  productId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  notes: string;
}

interface ModalState {
  open: boolean;
  editIndex: number | null;
}

const CURRENCIES = ['USD', 'EUR', 'TRY'];
const VAT_RATES = ['0', '1', '8', '10', '18', '20'];
const EMPTY_ITEM: LineItem = { description: '', quantity: '1', unitPrice: '', discount: '0', notes: '' };

function lineTotal(item: LineItem) {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discount) || 0;
  return qty * price * (1 - disc / 100);
}

function ItemModal({ initial, currency, products, onConfirm, onClose }: {
  initial: LineItem; currency: string; products: any[];
  onConfirm: (item: LineItem) => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const [item, setItem] = useState<LineItem>({ ...initial });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const set = (field: keyof LineItem, val: string) => setItem(p => ({ ...p, [field]: val }));

  const handleProductSelect = (productId: string) => {
    if (!productId) { setSelectedProduct(null); return; }
    const p = products.find(p => p.id === productId);
    if (!p) return;
    setSelectedProduct(p);
    setItem(prev => ({ ...prev, productId: p.id, description: p.name, unitPrice: String(p.unitPrice) }));
  };

  useEffect(() => {
    if (initial.productId && !selectedProduct) {
      const p = products.find(p => p.id === initial.productId);
      if (p) setSelectedProduct(p);
    }
  }, []);

  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discount) || 0;
  const gross = qty * price;
  const discAmount = gross * disc / 100;
  const total = gross - discAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-red-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">{item.description || t('newInvoice', 'returnProductTitle')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'selectFromCatalog')}</label>
              <select value={item.productId ?? ''} onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none bg-white">
                <option value="">{t('newInvoice', 'manualEntry')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'productName')}</label>
            <input value={item.description} onChange={e => set('description', e.target.value)} placeholder={t('newInvoice', 'enterDescription')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'qty')}</label>
              <input type="text" inputMode="decimal" value={item.quantity} onChange={e => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-red-400 outline-none" />
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'unitPrice')}</label>
              <div className="flex">
                <input type="text" inputMode="decimal" value={item.unitPrice} onChange={e => set('unitPrice', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-red-400 outline-none min-w-0" />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">{currency}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'discount')}</label>
              <div className="flex">
                <input type="text" inputMode="decimal" value={item.discount} onChange={e => set('discount', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-red-400 outline-none min-w-0" />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">%</span>
              </div>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">{t('newInvoice', 'gross')}</span>
              <span className="text-sm text-slate-600">{gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500">{t('newInvoice', 'discountPct')}{disc})</span>
                <span className="text-sm text-red-500">-{discAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-red-200 pt-2 mt-1">
              <span className="text-sm font-bold text-slate-700">{t('newInvoice', 'total')}</span>
              <span className="text-lg font-bold text-red-700">-{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'optionalNotes')}</label>
            <input value={item.notes} onChange={e => set('notes', e.target.value)} placeholder={t('newInvoice', 'enterDescription')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
          </div>
          <button type="button" onClick={() => { if (item.description || item.unitPrice) onConfirm(item); }}
            disabled={!item.description && !item.unitPrice}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> {t('common', 'add')}
          </button>
        </div>
      </div>
    </div>
  );
}

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
          <h3 className="text-base font-semibold text-slate-800">{t('newInvoice', 'currencyMismatch')}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-2">
          <strong className="text-slate-800">{invoiceCurrency}</strong> {t('newInvoice', 'currencyMismatchDesc')} <strong className="text-slate-800">{customerCurrency}</strong>
        </p>
        <p className="text-xs text-slate-400 mb-5">{t('newInvoice', 'continueQuestion')}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common', 'cancel')}</button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">{t('newInvoice', 'continue')}</button>
        </div>
      </div>
    </div>
  );
}

export default function ReturnInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false, editIndex: null });
  const [draftItem, setDraftItem] = useState<LineItem>(EMPTY_ITEM);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [currencyWarning, setCurrencyWarning] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const lockedCustomerId = searchParams?.get('customerId') ?? '';

  const [form, setForm] = useState({
    customerId: lockedCustomerId,
    invoiceNo: '',
    date: toDateInputValue(),
    dueDate: '',
    irsaliyeNo: '',
    sevkTarihi: toDateInputValue(),
    currency: 'USD',
    vatRate: '0',
    notes: '',
  });

  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(console.error);
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  const setField = (field: string, val: string) => setForm(p => ({ ...p, [field]: val }));

  const filteredProducts = productSearch.length >= 2
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase())))
    : [];

  const selectedCustomer = customers.find(c => c.id === form.customerId);

  useEffect(() => {
    if (selectedCustomer?.currency) setField('currency', selectedCustomer.currency);
  }, [form.customerId]);

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
    }
    setModal({ open: false, editIndex: null });
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleProductClick = (product: any) => {
    setProductSearch('');
    setShowDropdown(false);
    openNewModal({ productId: product.id, description: product.name, unitPrice: String(product.unitPrice) });
  };

  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const vatRate = parseFloat(form.vatRate) || 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const handleSubmit = async () => {
    if (!form.customerId) return alert(t('newInvoice', 'selectCustomer'));
    if (items.length === 0) return alert(t('newInvoice', 'noItems'));
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items, isReturn: true }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(form.customerId ? `/customers/${form.customerId}` : `/invoices/${data.id}`);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="space-y-3 h-full">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('common', 'back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || items.length === 0 || !form.customerId}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {saving ? t('newInvoice', 'saving') : t('newInvoice', 'saveReturn')}
          </button>
        </div>

        <div className="flex gap-4 items-start flex-col lg:flex-row">
          {/* LEFT PANEL */}
          <div className="w-full lg:w-[340px] lg:flex-shrink-0 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-red-600 px-4 py-3">
              <p className="text-white font-semibold text-sm truncate">
                {selectedCustomer?.name ? `${selectedCustomer.name} — ${t('newInvoice', 'returnTitle')}` : t('newInvoice', 'returnTitle')}
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {t('customerDetail', 'returnInvoice')}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'customer')} *</label>
                {lockedCustomerId ? (
                  <div className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-700 font-medium">
                    {selectedCustomer?.name || lockedCustomerId}
                  </div>
                ) : (
                  <select required value={form.customerId} onChange={e => setField('customerId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none bg-white">
                    <option value="">{t('newInvoice', 'selectCustomerPlaceholder')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'invoiceNo')}</label>
                <input value={form.invoiceNo} onChange={e => setField('invoiceNo', e.target.value)} placeholder={t('newInvoice', 'autoGenerated')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'date')}</label>
                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'dueDate')}</label>
                <input type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'irsaliyeNo')}</label>
                <input value={form.irsaliyeNo} onChange={e => setField('irsaliyeNo', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'shippingDate')}</label>
                <input type="date" value={form.sevkTarihi} onChange={e => setField('sevkTarihi', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'currency')}</label>
                <div className="relative">
                  <select value={form.currency} onChange={e => handleCurrencyChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none bg-white">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {selectedCustomer && form.currency !== selectedCustomer.currency && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {t('newInvoice', 'customerCurrency')} {selectedCustomer.currency}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('newInvoice', 'notes')}</label>
                <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none resize-none" />
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-red-600 px-4 py-3">
              <p className="text-white font-semibold text-sm uppercase tracking-wide">{t('newInvoice', 'returnTitle')}</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <input
                  ref={searchRef}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder={t('newInvoice', 'searchProducts')}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-red-400 rounded-lg text-sm outline-none"
                />
                {showDropdown && productSearch.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">{t('common', 'noResults')}</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button key={p.id} type="button" onMouseDown={() => handleProductClick(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-red-500 hover:text-white text-sm transition-colors text-left">
                          <span className="font-medium">{p.name}</span>
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
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium">
                <Plus className="w-4 h-4" /> {t('newInvoice', 'manualAddItem')}
              </button>

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
                        <tr key={i} className="hover:bg-red-50/30">
                          <td className="py-2 pr-2">
                            <p className="font-medium text-slate-800">{item.description}</p>
                            {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-600">{item.quantity}</td>
                          <td className="py-2 px-2 text-right text-slate-600">
                            {(parseFloat(item.unitPrice) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {parseFloat(item.discount) > 0 ? `%${item.discount}` : '—'}
                          </td>
                          <td className="py-2 text-right font-semibold text-red-700">
                            -{lineTotal(item).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
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
                    <span>{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}</span>
                  </div>
                  {vatRate > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>{t('newInvoice', 'vatAmount')} (%{vatRate})</span>
                      <span>{vatAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-red-700 border-t pt-2">
                    <span>{t('newInvoice', 'grandTotal')}</span>
                    <span>-{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}</span>
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-red-200 rounded-xl text-slate-400 text-sm">
                  {t('newInvoice', 'emptyItemsHint')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal.open && (
        <ItemModal
          initial={draftItem}
          currency={form.currency}
          products={products}
          onConfirm={handleModalConfirm}
          onClose={() => setModal({ open: false, editIndex: null })}
        />
      )}

      {currencyWarning && (
        <CurrencyWarning
          invoiceCurrency={pendingCurrency}
          customerCurrency={selectedCustomer?.currency || ''}
          onConfirm={() => { setField('currency', pendingCurrency); setCurrencyWarning(false); }}
          onCancel={() => { setCurrencyWarning(false); }}
        />
      )}
    </AppShell>
  );
}
