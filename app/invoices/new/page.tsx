'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

const CURRENCIES = ['USD', 'EUR', 'TRY'];
const VAT_RATES = ['0', '1', '8', '10', '18', '20'];

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [form, setForm] = useState({
    customerId: searchParams?.get('customerId') ?? '',
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: 'USD',
    vatRate: '0',
    notes: '',
  });

  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(console.error);
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  const setField = (field: string, val: string) => setForm(p => ({ ...p, [field]: val }));

  const setItem = (i: number, field: keyof LineItem, val: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addItem = () => setItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '' }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const fillFromProduct = (i: number, productId: string) => {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    setItems(prev => prev.map((item, idx) => idx === i
      ? { ...item, description: p.name, unitPrice: String(p.unitPrice) }
      : item
    ));
  };

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
  const vatRate = parseFloat(form.vatRate) || 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) return alert('Müşteri seçiniz');
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
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Kalemler</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 font-medium border-b">
                    <th className="text-left pb-2 pr-2">Ürün/Hizmet</th>
                    <th className="text-right pb-2 px-2 w-24">Miktar</th>
                    <th className="text-right pb-2 px-2 w-32">Birim Fiyat</th>
                    <th className="text-right pb-2 pl-2 w-32">Toplam</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item, i) => {
                    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
                    return (
                      <tr key={i}>
                        <td className="py-2 pr-2">
                          <div className="flex gap-1">
                            {products.length > 0 && (
                              <select
                                onChange={e => { if (e.target.value) fillFromProduct(i, e.target.value); e.target.value = ''; }}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white w-28 flex-shrink-0"
                              >
                                <option value="">Ürün...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            )}
                            <input
                              value={item.description}
                              onChange={e => setItem(i, 'description', e.target.value)}
                              placeholder="Açıklama"
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-0"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number" step="0.001" min="0"
                            value={item.quantity}
                            onChange={e => setItem(i, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number" step="0.0001" min="0"
                            value={item.unitPrice}
                            onChange={e => setItem(i, 'unitPrice', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="py-2 pl-2 text-right font-medium text-slate-700">
                          {lineTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 pl-1">
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(i)} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Kalem Ekle
            </button>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">KDV Oranı</span>
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
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notlar</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Fatura Oluştur
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
