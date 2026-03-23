'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { Loader2, Plus, Trash2, Pencil, X, ArrowLeft, Save } from 'lucide-react';

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

// ── Line Item Modal ───────────────────────────────────────────────────────────
function ItemModal({ initial, currency, products, onConfirm, onClose }: {
  initial: LineItem; currency: string; products: any[];
  onConfirm: (item: LineItem) => void; onClose: () => void;
}) {
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
        <div className="bg-emerald-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">{item.description || 'Ürün / Hizmet'}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Kataloğundan Seç</label>
              <select value={item.productId ?? ''} onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                <option value="">Manuel giriş...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ürün / Hizmet Adı</label>
            <input value={item.description} onChange={e => set('description', e.target.value)} placeholder="Açıklama girin"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Miktar (Ad)</label>
              <input type="number" step="0.001" min="0" value={item.quantity} onChange={e => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Stok Durumu</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                {selectedProduct ? `${selectedProduct.stock} ${selectedProduct.unit}` : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fiyat</label>
              <div className="flex">
                <input type="number" step="0.0001" min="0" value={item.unitPrice} onChange={e => set('unitPrice', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0" />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">{currency}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">İndirim</label>
              <div className="flex">
                <input type="number" step="0.1" min="0" max="100" value={item.discount} onChange={e => set('discount', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0" />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">%</span>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">Brüt</span>
              <span className="text-sm text-slate-600">{gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500">İndirim (-%{disc})</span>
                <span className="text-sm text-red-500">-{discAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-amber-200 pt-2 mt-1">
              <span className="text-sm font-bold text-slate-700">TOPLAM</span>
              <span className="text-lg font-bold text-slate-800">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currency}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama (isteğe bağlı)</label>
            <input value={item.notes} onChange={e => set('notes', e.target.value)} placeholder="isteğe bağlı açıklama girebilirsiniz"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <button type="button" onClick={() => { if (item.description || item.unitPrice) onConfirm(item); }}
            disabled={!item.description && !item.unitPrice}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false, editIndex: null });
  const [draftItem, setDraftItem] = useState<LineItem>(EMPTY_ITEM);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    customerId: searchParams?.get('customerId') ?? '',
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    irsaliyeNo: '',
    sevkTarihi: new Date().toISOString().split('T')[0],
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

  const selectedCustomer = customers.find(c => c.id === form.customerId);

  // Auto-set currency from customer when customer changes
  useEffect(() => {
    if (selectedCustomer?.currency) {
      setField('currency', selectedCustomer.currency);
    }
  }, [form.customerId]);

  const handleSubmit = async (saveType: 'fatura') => {
    if (!form.customerId) return alert('Müşteri seçiniz');
    if (items.length === 0) return alert('En az bir kalem ekleyiniz');
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await res.json();
      if (data.id) {
        // Redirect to customer detail page
        router.push(form.customerId ? `/customers/${form.customerId}` : `/invoices/${data.id}`);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="space-y-3 h-full">
        {/* Top action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Geri Dön
          </button>
          <button
            onClick={() => handleSubmit('fatura')}
            disabled={saving || items.length === 0 || !form.customerId}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Fatura Kaydet
          </button>
        </div>

        {/* Split Layout */}
        <div className="flex gap-4 items-start flex-col lg:flex-row">
          {/* LEFT PANEL — Customer info + doc fields */}
          <div className="w-full lg:w-[340px] lg:flex-shrink-0 bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Blue header with customer name */}
            <div className="bg-blue-600 px-4 py-3">
              <p className="text-white font-semibold text-sm truncate">
                {selectedCustomer?.name || 'Müşteri Seçilmedi'}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {/* Customer select */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Müşteri *</label>
                <select required value={form.customerId} onChange={e => setField('customerId', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Müşteri seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Belge No</label>
                <input value={form.invoiceNo} onChange={e => setField('invoiceNo', e.target.value)} placeholder="Otomatik oluşturulur"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tarihi</label>
                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Vadesi</label>
                <input type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">İrsaliye No</label>
                <input value={form.irsaliyeNo} onChange={e => setField('irsaliyeNo', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Sevk Tarihi</label>
                <input type="date" value={form.sevkTarihi} onChange={e => setField('sevkTarihi', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Para Birimi</label>
                {selectedCustomer ? (
                  <div className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-700 flex items-center justify-between">
                    <span className="font-semibold">{form.currency}</span>
                    <span className="text-xs text-slate-400">Müşteri para birimi</span>
                  </div>
                ) : (
                  <select value={form.currency} onChange={e => setField('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama</label>
                <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — Product search + items */}
          <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Green header */}
            <div className="bg-green-600 px-4 py-3">
              <p className="text-white font-semibold text-sm uppercase tracking-wide">Ürün / Hizmetler</p>
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
                  placeholder="Ürün isminden arayın veya barkod okutun"
                  className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-green-500 rounded-lg text-sm outline-none"
                />
                {showDropdown && productSearch.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">Sonuç bulunamadı</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => handleProductClick(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-500 hover:text-white text-sm transition-colors text-left"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs opacity-70 ml-2 flex-shrink-0">{p.stock} {p.unit}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {showDropdown && productSearch.length > 0 && productSearch.length < 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-md z-10">
                    <div className="px-4 py-3 text-sm text-slate-400">En az iki harf yazın...</div>
                  </div>
                )}
              </div>

              {/* Manual add button */}
              <button type="button" onClick={() => openNewModal()}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus className="w-4 h-4" /> Manuel Kalem Ekle
              </button>

              {/* Items table */}
              {items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 font-medium border-b">
                        <th className="text-left pb-2">Ürün/Hizmet</th>
                        <th className="text-right pb-2 px-2 w-20">Miktar</th>
                        <th className="text-right pb-2 px-2 w-28">Birim Fiyat</th>
                        <th className="text-right pb-2 px-2 w-16">İndirim</th>
                        <th className="text-right pb-2 w-28">Toplam</th>
                        <th className="w-14"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
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
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {lineTotal(item).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
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
                    <span className="text-sm text-slate-500">KDV Oranı</span>
                    <select value={form.vatRate} onChange={e => setField('vatRate', e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-24">
                      {VAT_RATES.map(r => <option key={r} value={r}>%{r}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Ara Toplam</span>
                    <span>{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}</span>
                  </div>
                  {vatRate > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>KDV (%{vatRate})</span>
                      <span>{vatAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-800 border-t pt-2">
                    <span>Genel Toplam</span>
                    <span>{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}</span>
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                  Ürün aramak için yukarıya yazın veya "Manuel Kalem Ekle" butonunu kullanın
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <ItemModal
          initial={draftItem}
          currency={form.currency}
          products={products}
          onConfirm={handleModalConfirm}
          onClose={() => setModal({ open: false, editIndex: null })}
        />
      )}
    </AppShell>
  );
}
