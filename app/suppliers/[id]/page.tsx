'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  ArrowLeft, Loader2, Pencil, Save, X, Phone, Mail, MapPin, Hash,
  Download, RotateCcw, Banknote, CheckCircle2, ShoppingBag, Plus, Trash2, Search, ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-orange-100 text-orange-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};
const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı'];
const CURRENCIES = ['TRY', 'USD', 'EUR'];
const RECORD_CURRENCY = 'TRY';

// ── OdemeModal ─────────────────────────────────────────────────────────────
function OdemeModal({ supplier, onClose, onSaved }: {
  supplier: any; onClose: () => void; onSaved: (amount: number) => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: '',
    paymentCurrency: 'TRY',
    amount: '',
    exchangeRate: '',
    recordedAmount: '',
    method: 'Nakit',
    notes: '',
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (form.paymentCurrency === RECORD_CURRENCY) {
      setForm(p => ({ ...p, exchangeRate: '', recordedAmount: '' }));
      return;
    }
    fetch('/api/company').then(r => r.json()).then(d => {
      let rate = '';
      if (form.paymentCurrency === 'USD' && d.usdToTry) rate = String(d.usdToTry);
      else if (form.paymentCurrency === 'EUR' && d.eurToTry) rate = String(d.eurToTry);
      if (rate) {
        const a = parseFloat(form.amount) || 0;
        setForm(p => ({ ...p, exchangeRate: rate, recordedAmount: a > 0 ? String(a * parseFloat(rate)) : '' }));
      }
    }).catch(() => {});
  }, [form.paymentCurrency]);

  const isSameCurrency = form.paymentCurrency === RECORD_CURRENCY;
  const amt = parseFloat(form.amount) || 0;
  const finalRecorded = isSameCurrency ? amt : (parseFloat(form.recordedAmount) || 0);

  const handleAmountChange = (v: string) => {
    const a = parseFloat(v) || 0;
    const r = parseFloat(form.exchangeRate) || 0;
    setForm(p => ({ ...p, amount: v, recordedAmount: (!isSameCurrency && r > 0 && a > 0) ? String(a * r) : p.recordedAmount }));
  };
  const handleRateChange = (v: string) => {
    const r = parseFloat(v) || 0;
    setForm(p => ({ ...p, exchangeRate: v, recordedAmount: (amt > 0 && r > 0) ? String(amt * r) : p.recordedAmount }));
  };
  const handleRecordedChange = (v: string) => {
    const rec = parseFloat(v) || 0;
    setForm(p => ({ ...p, recordedAmount: v, exchangeRate: (amt > 0 && rec > 0) ? String(rec / amt) : p.exchangeRate }));
  };

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accountId || amt <= 0 || (!isSameCurrency && finalRecorded <= 0)) return;
    setSaving(true);
    try {
      const savedAmt = isSameCurrency ? amt : finalRecorded;
      let notes = form.notes || null;
      if (!isSameCurrency) {
        const rateNote = `${amt} ${form.paymentCurrency} @ ${form.exchangeRate}`;
        notes = notes ? `${notes} | ${rateNote}` : rateNote;
      }
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          accountId: form.accountId,
          amount: savedAmt,
          currency: RECORD_CURRENCY,
          originalAmount: isSameCurrency ? null : amt,
          originalCurrency: isSameCurrency ? null : form.paymentCurrency,
          exchangeRate: isSameCurrency ? null : parseFloat(form.exchangeRate) || null,
          date: form.date,
          method: form.method,
          notes,
        }),
      });
      onSaved(savedAmt);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const canSave = !!form.accountId && amt > 0 && (isSameCurrency || finalRecorded > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="bg-teal-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">{t('modal', 'payTitle')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm text-teal-800 font-medium truncate">
            {supplier.name}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'date')}</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'account')}</label>
            <select required value={form.accountId} onChange={e => set('accountId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white ${!form.accountId ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}>
              <option value="">{t('modal', 'selectAccount')}</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'paymentCurrency')}</label>
              <select value={form.paymentCurrency} onChange={e => set('paymentCurrency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'amount')}</label>
              <input required type="number" step="0.01" min="0.01" value={form.amount}
                onChange={e => handleAmountChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-right" />
            </div>
          </div>
          {!isSameCurrency && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    {t('modal', 'rate')} (1 {form.paymentCurrency}={RECORD_CURRENCY})
                  </label>
                  <input type="number" step="0.0000000001" min="0.0000000001" value={form.exchangeRate}
                    onChange={e => handleRateChange(e.target.value)} placeholder="0.0000"
                    className="w-full px-2 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    {t('modal', 'recordedAmount')} ({RECORD_CURRENCY}) *
                  </label>
                  <input type="number" step="0.01" min="0.01" value={form.recordedAmount}
                    onChange={e => handleRecordedChange(e.target.value)} placeholder="0.00"
                    className="w-full px-2 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right bg-white font-semibold" />
                </div>
              </div>
              <p className="text-xs text-blue-500">{t('modal', 'rateHint')}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'paymentMethod')}</label>
            <select value={form.method} onChange={e => set('method', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'notes')}</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common', 'cancel')}</button>
            <button type="submit" disabled={saving || !canSave}
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── IadeModal ──────────────────────────────────────────────────────────────
function IadeModal({ supplier, onClose, onSaved }: {
  supplier: any; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    amount: '', date: new Date().toISOString().split('T')[0], method: 'Nakit', notes: 'İade',
  });
  const [saving, setSaving] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          amount: form.amount,
          currency: 'TRY',
          date: form.date,
          method: form.method,
          notes: form.notes,
        }),
      });
      onSaved();
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="bg-amber-500 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">{t('modal', 'returnTitle')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'amount')}</label>
            <input required type="number" step="0.01" min="0.01" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'date')}</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('supplierDetail', 'method')}</label>
            <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white">
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'notes')}</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">{t('common', 'cancel')}</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AlışModal ──────────────────────────────────────────────────────────────
type LineItem = { id: number; productId: string; productName: string; qty: string; unitPrice: string };

function AlışModal({ supplier, onClose, onSaved }: {
  supplier: any; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    invoiceNo: '',
    currency: 'TRY',
    notes: '',
  });
  const [items, setItems] = useState<LineItem[]>([
    { id: 1, productId: '', productName: '', qty: '1', unitPrice: '' },
  ]);
  const [products, setProducts] = useState<any[]>([]);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', unitPrice: '', currency: 'TRY' });
  const [saving, setSaving] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const total = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0), 0);

  const addRow = () => setItems(p => [...p, { id: Date.now(), productId: '', productName: '', qty: '1', unitPrice: '' }]);
  const removeRow = (id: number) => setItems(p => p.filter(r => r.id !== id));
  const updateItem = (id: number, field: keyof LineItem, value: string) =>
    setItems(p => p.map(r => r.id === id ? { ...r, [field]: value } : r));

  const selectProduct = (itemId: number, product: any) => {
    setItems(p => p.map(r => r.id === itemId
      ? { ...r, productId: product.id, productName: product.name, unitPrice: String(product.unitPrice) }
      : r));
    setOpenDropdown(null);
  };

  const filteredProducts = (query: string) => {
    const q = query.toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.unitPrice) return;
    setCreatingProduct(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProduct.name, unitPrice: parseFloat(newProduct.unitPrice), currency: newProduct.currency }),
      });
      const created = await res.json();
      setProducts(p => [...p, created]);
      const emptyRow = items.find(r => !r.productId);
      if (emptyRow) {
        selectProduct(emptyRow.id, created);
      } else {
        const newId = Date.now();
        setItems(p => [...p, { id: newId, productId: created.id, productName: created.name, qty: '1', unitPrice: String(created.unitPrice) }]);
      }
      setNewProduct({ name: '', unitPrice: '', currency: 'TRY' });
      setShowNewProduct(false);
    } finally { setCreatingProduct(false); }
  };

  const validItems = items.filter(i => parseFloat(i.qty) > 0 && parseFloat(i.unitPrice) > 0);
  const canSavePurchase = validItems.length > 0 && total > 0;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSavePurchase) return;
    setSaving(true);
    try {
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          invoiceNo: form.invoiceNo || null,
          date: form.date,
          currency: form.currency,
          total,
          notes: form.notes || null,
          items: validItems.map(i => ({ productId: i.productId || null, qty: i.qty, unitPrice: i.unitPrice })),
        }),
      });
      onSaved();
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-indigo-600 rounded-t-2xl px-5 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-white font-semibold">{t('supplierDetail', 'newPurchase')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-3 overflow-y-auto flex-1" ref={dropdownRef}>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-800 font-medium truncate">
              {supplier.name}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'date')}</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('supplierDetail', 'invoiceNo')}</label>
                <input value={form.invoiceNo} onChange={e => setForm(p => ({ ...p, invoiceNo: e.target.value }))}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Döviz</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-slate-500">Ürünler</label>
                <button type="button" onClick={addRow}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Satır Ekle
                </button>
              </div>
              <div className="space-y-2">
                {items.map(item => {
                  const rowTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                  const fp = filteredProducts(item.productName);
                  return (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-2 space-y-2">
                      <div className="relative flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <input
                          value={item.productName}
                          onChange={e => {
                            updateItem(item.id, 'productName', e.target.value);
                            updateItem(item.id, 'productId', '');
                            setOpenDropdown(item.id);
                          }}
                          onFocus={() => setOpenDropdown(item.id)}
                          placeholder="Ürün ara veya yaz..."
                          className="flex-1 text-sm outline-none"
                        />
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeRow(item.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                          </button>
                        )}
                        {openDropdown === item.id && fp.length > 0 && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 w-full max-h-40 overflow-y-auto">
                            {fp.map((prod: any) => (
                              <button key={prod.id} type="button"
                                onMouseDown={() => selectProduct(item.id, prod)}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 flex items-center justify-between">
                                <span>{prod.name}</span>
                                <span className="text-xs text-slate-400">{prod.unitPrice} {prod.currency}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-slate-400 mb-0.5 block">Miktar</label>
                          <input type="number" step="0.01" min="0.01" value={item.qty}
                            onChange={e => updateItem(item.id, 'qty', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-right outline-none focus:ring-1 focus:ring-indigo-400" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-0.5 block">Birim Fiyat</label>
                          <input type="number" step="0.01" min="0.01" value={item.unitPrice}
                            onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                            className={`w-full px-2 py-1 border rounded text-right outline-none focus:ring-1 focus:ring-indigo-400 ${
                              parseFloat(item.qty) > 0 && !parseFloat(item.unitPrice)
                                ? 'border-orange-300 bg-orange-50'
                                : 'border-slate-200'
                            }`} />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-0.5 block">{t('supplierDetail', 'amount')}</label>
                          <div className="px-2 py-1 bg-slate-50 rounded text-right font-semibold text-slate-700">
                            {rowTotal > 0 ? rowTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!showNewProduct ? (
                <button type="button" onClick={() => setShowNewProduct(true)}
                  className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 underline">
                  Listede olmayan ürün eklemek için tıklayın
                </button>
              ) : (
                <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-indigo-700">Yeni Ürün Ekle</p>
                  <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ürün adı"
                    className="w-full px-2 py-1.5 border border-indigo-200 rounded text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="0.01" value={newProduct.unitPrice}
                      onChange={e => setNewProduct(p => ({ ...p, unitPrice: e.target.value }))}
                      placeholder="Birim fiyat"
                      className="px-2 py-1.5 border border-indigo-200 rounded text-sm outline-none text-right" />
                    <select value={newProduct.currency} onChange={e => setNewProduct(p => ({ ...p, currency: e.target.value }))}
                      className="px-2 py-1.5 border border-indigo-200 rounded text-sm outline-none bg-white">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowNewProduct(false)}
                      className="flex-1 py-1 border border-slate-200 rounded text-xs text-slate-500 hover:bg-slate-50">{t('common', 'cancel')}</button>
                    <button type="button" onClick={handleCreateProduct}
                      disabled={creatingProduct || !newProduct.name || !newProduct.unitPrice}
                      className="flex-1 py-1 bg-indigo-600 text-white rounded text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                      {creatingProduct ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Ekle
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Genel Toplam</span>
              <span className="text-lg font-bold text-slate-800">
                {total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.currency}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'notes')}</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div className="flex gap-3 p-5 border-t flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common', 'cancel')}</button>
            <button type="submit" disabled={saving || !canSavePurchase}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SupplierDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showAlıs, setShowAlıs] = useState(false);
  const [showOdeme, setShowOdeme] = useState(false);
  const [showIade, setShowIade] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [purchasesShown, setPurchasesShown] = useState(10);
  const [paymentsShown, setPaymentsShown] = useState(10);

  const STATUS_LABEL: Record<string, string> = {
    DRAFT: t('invoices', 'statusDraft'),
    PENDING: t('invoices', 'statusPending'),
    PARTIAL: t('invoices', 'statusPartial'),
    PAID: t('invoices', 'statusPaid'),
    CANCELLED: t('invoices', 'statusCancelled'),
  };

  const load = () => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/suppliers/${params.id}`)
      .then(r => r.json())
      .then(d => { setSupplier(d); setForm(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [params?.id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/suppliers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSupplier((prev: any) => ({ ...prev, ...form }));
    setEditing(false);
    setSaving(false);
  };

  const handleExtrePdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    if (!supplier) return;

    const tr = (s: string) => (s || '').toString()
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const M = 15;
    let y = M;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(tr(supplier.name), M, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('HESAP EKSTRESI', M, 17);
    doc.text(new Date().toLocaleDateString('tr-TR'), W - M, 17, { align: 'right' });

    y = 32;
    doc.setTextColor(30, 30, 30);

    const txns: any[] = [
      ...(supplier.purchases || []).map((p: any) => ({
        date: p.date,
        label: `Alis: ${p.invoiceNo || 'Faturasiz'}`,
        debit: p.total,
        credit: 0,
        status: STATUS_LABEL[p.status],
      })),
      ...(supplier.payments || []).map((p: any) => ({
        date: p.date,
        label: `Odeme: ${p.method}${p.notes ? ' - ' + p.notes : ''}`,
        debit: 0,
        credit: p.amount,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    doc.setFillColor(241, 245, 249);
    doc.rect(M, y - 4, W - 2 * M, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
    doc.text('TARIH', M + 1, y); doc.text('ISLEM', M + 25, y);
    doc.text('BORC', W - M - 50, y, { align: 'right' });
    doc.text('ALACAK', W - M - 20, y, { align: 'right' });
    doc.text('BAKIYE', W - M, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    let balance = 0;
    txns.forEach(tx => {
      balance += tx.debit - tx.credit;
      doc.text(new Date(tx.date).toLocaleDateString('tr-TR'), M + 1, y);
      const label = tr(tx.label).substring(0, 40);
      doc.text(label, M + 25, y);
      if (tx.debit > 0) doc.text(tx.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }), W - M - 50, y, { align: 'right' });
      if (tx.credit > 0) doc.text(tx.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }), W - M - 20, y, { align: 'right' });
      doc.text(balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }), W - M, y, { align: 'right' });
      y += 6;
      doc.setDrawColor(230, 230, 230); doc.line(M, y - 1, W - M, y - 1);
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(W - M - 80, y - 4, 80, 8, 'F');
    doc.text('NET BAKIYE:', W - M - 60, y);
    doc.text(balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }), W - M, y, { align: 'right' });

    doc.save(`${tr(supplier.name)}_Hesap_Ekstresi.pdf`);
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  if (!supplier || supplier.error) return <AppShell><div className="text-center py-12 text-slate-400">Tedarikçi bulunamadı</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">
        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Tedarikçiler
        </button>

        {/* Header card */}
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['name', 'Firma Adı'], ['taxId', 'VKN'], ['phone', 'Telefon'], ['email', 'E-posta']].map(([f, l]) => (
                  <div key={f}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input value={form[f] ?? ''} onChange={e => setForm((p: any) => ({ ...p, [f]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 outline-none bg-white" />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Adres</label>
                  <textarea value={form.address ?? ''} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))}
                    rows={2} className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 outline-none resize-none bg-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notlar</label>
                  <textarea value={form.notes ?? ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                    rows={2} className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 outline-none resize-none bg-white" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => setEditing(false)}
                    className="px-4 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common', 'cancel')}</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t('common', 'save')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-800 mb-1">{supplier.name}</h1>
                <div className="space-y-1 text-sm text-slate-600">
                  {supplier.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{supplier.email}</div>}
                  {supplier.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />{supplier.address}</div>}
                  {supplier.taxId && <div className="flex items-center gap-2"><Hash className="w-4 h-4 text-slate-400" />VKN: {supplier.taxId}</div>}
                  {supplier.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{supplier.phone}</div>}
                  {supplier.notes && <p className="text-xs text-slate-400 italic mt-1">{supplier.notes}</p>}
                </div>
              </>
            )}
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="p-2 hover:bg-cyan-100 rounded-lg transition-colors flex-shrink-0">
              <Pencil className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 text-white bg-red-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('supplierDetail', 'balance')}</p>
            <p className="text-2xl font-bold">{(supplier.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">Borç</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl p-4 text-white bg-blue-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('supplierDetail', 'totalPurchased')}</p>
            <p className="text-2xl font-bold">{(supplier.totalPurchased || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">{(supplier.purchases || []).length} alış</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-xl p-4 text-white bg-teal-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('supplierDetail', 'totalPaid')}</p>
            <p className="text-2xl font-bold">{(supplier.totalPaid || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">{(supplier.payments || []).length} ödeme</p>
          </motion.div>
        </div>

        {/* Success overlay */}
        {successAmount !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto border border-teal-200 animate-in fade-in zoom-in duration-200">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-teal-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">Ödeme Tamamlandı</p>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">{successAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY</span> ödendi
              </p>
              <button onClick={() => setSuccessAmount(null)}
                className="mt-1 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
                Tamam
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowAlıs(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <ShoppingBag className="w-4 h-4" /> {t('supplierDetail', 'newPurchase')}
          </button>
          <button onClick={() => setShowOdeme(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Banknote className="w-4 h-4" /> {t('supplierDetail', 'pay')}
          </button>
          <button onClick={() => setShowIade(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <RotateCcw className="w-4 h-4" /> {t('modal', 'returnTitle')}
          </button>
          <Link href={`/suppliers/${params.id}/ekstre`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Download className="w-4 h-4" /> {t('supplierDetail', 'accountStatement')}
          </Link>
        </div>

        {/* Purchases + Payments — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Purchases table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-700">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide">{t('supplierDetail', 'previousPurchases')}</h2>
          </div>
          {!supplier.purchases?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm">{t('supplierDetail', 'noRecords')}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                    <th className="px-4 py-2 text-left">{t('supplierDetail', 'date')}</th>
                    <th className="px-4 py-2 text-left">{t('supplierDetail', 'invoiceNo')}</th>
                    <th className="px-4 py-2 text-center">Durum</th>
                    <th className="px-4 py-2 text-right">{t('supplierDetail', 'amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplier.purchases.slice(0, purchasesShown).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-500">{new Date(p.date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{p.invoiceNo || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                        {p.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {supplier.purchases.length > purchasesShown && (
                <div className="px-4 py-3 border-t text-center">
                  <button onClick={() => setPurchasesShown(p => p + 10)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Daha Fazla Göster ({supplier.purchases.length - purchasesShown} adet daha)
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Payments table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-700">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide">{t('supplierDetail', 'previousPayments')}</h2>
          </div>
          {!supplier.payments?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm">{t('supplierDetail', 'noRecords')}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                    <th className="px-4 py-2 text-left">{t('supplierDetail', 'date')}</th>
                    <th className="px-4 py-2 text-right">{t('supplierDetail', 'amount')}</th>
                    <th className="px-4 py-2 text-left">{t('supplierDetail', 'method')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplier.payments.slice(0, paymentsShown).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-500">{new Date(p.date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-teal-600">
                        {p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {p.method}{p.notes ? ` (${p.notes})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {supplier.payments.length > paymentsShown && (
                <div className="px-4 py-3 border-t text-center">
                  <button onClick={() => setPaymentsShown(p => p + 10)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Daha Fazla Göster ({supplier.payments.length - paymentsShown} adet daha)
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        </div>{/* end grid */}
      </div>

      {showAlıs && (
        <AlışModal supplier={supplier} onClose={() => setShowAlıs(false)} onSaved={load} />
      )}
      {showIade && (
        <IadeModal supplier={supplier} onClose={() => setShowIade(false)} onSaved={load} />
      )}
      {showOdeme && (
        <OdemeModal
          supplier={supplier}
          onClose={() => setShowOdeme(false)}
          onSaved={(amount) => {
            setShowOdeme(false);
            setSuccessAmount(amount);
            load();
            setTimeout(() => setSuccessAmount(null), 4000);
          }}
        />
      )}
    </AppShell>
  );
}
