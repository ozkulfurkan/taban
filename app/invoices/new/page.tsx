'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, X } from 'lucide-react';

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
  editIndex: number | null; // null = new item
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

// ── Line Item Modal ──────────────────────────────────────────────────────────
function ItemModal({
  initial,
  currency,
  products,
  onConfirm,
  onClose,
}: {
  initial: LineItem;
  currency: string;
  products: any[];
  onConfirm: (item: LineItem) => void;
  onClose: () => void;
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
        {/* Header */}
        <div className="bg-emerald-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">
            {item.description || 'Ürün / Hizmet'}
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Product selector */}
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Kataloğundan Seç</label>
              <select
                value={item.productId ?? ''}
                onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="">Manuel giriş...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ürün / Hizmet Adı</label>
            <input
              value={item.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Açıklama girin"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Quantity + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Miktar (Ad)</label>
              <input
                type="number" step="0.001" min="0"
                value={item.quantity}
                onChange={e => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Stok Durumu</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                {selectedProduct
                  ? `${selectedProduct.stock} ${selectedProduct.unit}`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Price + Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fiyat</label>
              <div className="flex">
                <input
                  type="number" step="0.0001" min="0"
                  value={item.unitPrice}
                  onChange={e => set('unitPrice', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0"
                />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">
                  {currency}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">İndirim</label>
              <div className="flex">
                <input
                  type="number" step="0.1" min="0" max="100"
                  value={item.discount}
                  onChange={e => set('discount', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-l-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none min-w-0"
                />
                <span className="px-2 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-xs text-slate-500 flex items-center">%</span>
              </div>
            </div>
          </div>

          {/* Total display */}
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

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama (isteğe bağlı)</label>
            <input
              value={item.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="isteğe bağlı açıklama girebilirsiniz"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Confirm */}
          <button
            type="button"
            onClick={() => { if (item.description || item.unitPrice) onConfirm(item); }}
            disabled={!item.description && !item.unitPrice}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false, editIndex: null });
  const [draftItem, setDraftItem] = useState<LineItem>(EMPTY_ITEM);

  const [form, setForm] = useState({
    customerId: searchParams?.get('customerId') ?? '',
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
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

  const openNewModal = () => {
    setDraftItem({ ...EMPTY_ITEM });
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

  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const vatRate = parseFloat(form.vatRate) || 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (data.id) router.push(`/invoices/${data.id}`);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Yeni Fatura</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Fatura Bilgileri</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Müşteri *</label>
                <select
                  required
                  value={form.customerId}
                  onChange={e => setField('customerId', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Müşteri seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fatura No</label>
                <input
                  value={form.invoiceNo}
                  onChange={e => setField('invoiceNo', e.target.value)}
                  placeholder="Otomatik oluşturulur"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Para Birimi</label>
                <select value={form.currency} onChange={e => setField('currency', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fatura Tarihi *</label>
                <input required type="date" value={form.date} onChange={e => setField('date', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vade Tarihi</label>
                <input type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Ürün / Hizmetler</h2>
              <button
                type="button"
                onClick={openNewModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Kalem Ekle
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-slate-400 text-sm mb-2">Henüz kalem eklenmedi</p>
                <button
                  type="button"
                  onClick={openNewModal}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  + İlk kalemi ekle
                </button>
              </div>
            ) : (
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
                  <span className="text-sm text-slate-500">KDV Oranı (Genel)</span>
                  <select
                    value={form.vatRate}
                    onChange={e => setField('vatRate', e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-24"
                  >
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
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Fatura Notu</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={saving || items.length === 0} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Fatura Oluştur
            </button>
          </div>
        </form>
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
