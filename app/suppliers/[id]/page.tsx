'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  ArrowLeft, Loader2, Pencil, Save, X, Phone, Mail, MapPin, Hash,
  Download, RotateCcw, Banknote, CheckCircle2, ShoppingBag, Plus, Trash2, Search, ChevronRight,
  ChevronDown, FileText, PlusCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { formatDate, toDateInputValue } from '@/lib/time';
import { useLanguage } from '@/lib/i18n/language-context';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';

function nowIstanbulISO(): string {
  const now = new Date();
  const istanbul = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return istanbul.toISOString().slice(0, 16);
}

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
const fmtDateC = formatDate;

// ── OdemeModal ─────────────────────────────────────────────────────────────
function OdemeModal({ supplier, onClose, onSaved }: {
  supplier: any; onClose: () => void; onSaved: (amount: number) => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    accountId: '',
    paymentCurrency: 'TRY',
    amount: '',
    exchangeRate: '',
    recordedAmount: '',
    notes: '',
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : []));
  }, []);

  // When account changes → update paymentCurrency to match account currency
  useEffect(() => {
    if (!form.accountId) return;
    const acc = accounts.find(a => a.id === form.accountId);
    if (!acc) return;
    const accCurrency = acc.currency || 'TRY';
    setForm(p => ({ ...p, paymentCurrency: accCurrency, exchangeRate: '', recordedAmount: '' }));
  }, [form.accountId, accounts]);

  // When paymentCurrency changes and differs from supplier.currency → prefill rate from settings
  // Rate = 1 supplier.currency = X paymentCurrency (e.g. 1 USD = 44.5 TRY)
  useEffect(() => {
    if (form.paymentCurrency === (supplier.currency || 'TRY')) {
      setForm(p => ({ ...p, exchangeRate: '', recordedAmount: '' }));
      return;
    }
    fetch('/api/company').then(r => r.json()).then(d => {
      let rate = '';
      if (supplier.currency === 'USD' && d.usdToTry) rate = String(d.usdToTry);
      else if (supplier.currency === 'EUR' && d.eurToTry) rate = String(d.eurToTry);
      if (rate) {
        const a = parseFloat(form.amount) || 0;
        const r = parseFloat(rate) || 0;
        setForm(p => ({ ...p, exchangeRate: String(Math.round(parseFloat(rate) * 10000) / 10000), recordedAmount: (a > 0 && r > 0) ? String(a / r) : '' }));
      }
    }).catch(() => {});
  }, [form.paymentCurrency]);

  // recordedAmount = amount / rate (paymentCurrency / rate = supplier.currency amount)
  const isSameCurrency = form.paymentCurrency === (supplier.currency || 'TRY');
  const amt = parseFloat(form.amount) || 0;
  const finalRecorded = isSameCurrency ? amt : (parseFloat(form.recordedAmount) || 0);

  const handleAmountChange = (v: string) => {
    const a = parseFloat(v) || 0;
    const r = parseFloat(form.exchangeRate) || 0;
    setForm(p => ({ ...p, amount: v, recordedAmount: (!isSameCurrency && r > 0 && a > 0) ? String(a / r) : p.recordedAmount }));
  };
  const handleRateChange = (v: string) => {
    const r = parseFloat(v) || 0;
    setForm(p => ({ ...p, exchangeRate: v, recordedAmount: (amt > 0 && r > 0) ? String(amt / r) : p.recordedAmount }));
  };
  const handleRecordedChange = (v: string) => {
    const rec = parseFloat(v) || 0;
    setForm(p => ({ ...p, recordedAmount: v, exchangeRate: (amt > 0 && rec > 0) ? String(Math.round((amt / rec) * 10000) / 10000) : p.exchangeRate }));
  };

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accountId || amt <= 0 || (!isSameCurrency && finalRecorded <= 0)) return;
    setSaving(true);
    try {
      const savedAmt = isSameCurrency ? amt : finalRecorded;
      let notes = form.notes || null;
      if (!isSameCurrency) {
        const rateNote = `${amt} ${form.paymentCurrency} | Kur: 1 ${supplier.currency} = ${form.exchangeRate} ${form.paymentCurrency}`;
        notes = notes ? `${notes} | ${rateNote}` : rateNote;
      }
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          accountId: form.accountId,
          amount: savedAmt,
          currency: supplier.currency || 'TRY',
          originalAmount: isSameCurrency ? null : amt,
          originalCurrency: isSameCurrency ? null : form.paymentCurrency,
          exchangeRate: isSameCurrency ? null : (parseFloat(form.exchangeRate) ? Math.round(parseFloat(form.exchangeRate) * 10000) / 10000 : null),
          date: nowIstanbulISO(),
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
        <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">{t('modal', 'payTitle')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm text-teal-800 font-medium truncate">
            {supplier.name}
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'amount')} {form.paymentCurrency ? `(${form.paymentCurrency})` : ''}</label>
            <input required type="number" step="0.01" min="0.01" value={form.amount}
              onChange={e => handleAmountChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-right" />
          </div>
          {!isSameCurrency && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    {t('modal', 'rate')} (1 {supplier.currency || 'TRY'}={form.paymentCurrency})
                  </label>
                  <input type="number" step="0.0001" min="0.0001" value={form.exchangeRate}
                    onChange={e => handleRateChange(e.target.value)} placeholder="0.0000"
                    className="w-full px-2 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    {t('modal', 'recordedAmount')} ({supplier.currency || 'TRY'}) *
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
    amount: '', method: 'Nakit', notes: 'İade',
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
          date: nowIstanbulISO(),
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

// ── BorcAlacakFisModal ─────────────────────────────────────────────────────
function BorcAlacakFisModal({ supplier, onClose, onSaved }: { supplier: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    tip: 'Alacak Fişi',
    dueDate: toDateInputValue(),
    amount: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    try {
      const notesArr = [form.dueDate ? `Vade:${form.dueDate}` : '', form.notes].filter(Boolean);
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          amount: parseFloat(form.amount),
          currency: 'TRY',
          date: nowIstanbulISO(),
          method: form.tip,
          notes: notesArr.join(' | ') || null,
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
        <div className="bg-teal-500 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">Borç-Alacak Fişleri</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
            Herhangi bir ödeme, alış ya da iade işlemi olmadan tedarikçi bakiyenizi değiştirmek için borç ya da alacak fişi kaydı oluşturabilirsiniz.
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">İşlem Tipi</label>
            <select value={form.tip} onChange={e => set('tip', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
              <option>Alacak Fişi</option>
              <option>Borç Fişi</option>
            </select>
            <p className="text-xs mt-1 text-slate-400">
              {form.tip === 'Borç Fişi' ? 'tedarikçiye borcunuz artacak' : 'tedarikçiye borcunuz azalacak'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Vade Tarihi</label>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tutar</label>
            <input required type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-right" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-colors">
              ✕ Vazgeç
            </button>
            <button type="submit" disabled={saving || !form.amount || parseFloat(form.amount) <= 0}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} ✓ Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BakiyeDuzeltModal ──────────────────────────────────────────────────────
function BakiyeDuzeltModal({ supplier, currentBalance, onClose, onSaved }: {
  supplier: any; currentBalance: number; onClose: () => void; onSaved: () => void;
}) {
  const [targetBalance, setTargetBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const target = parseFloat(targetBalance);
  const delta = isNaN(target) ? null : target - currentBalance;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === null || delta === 0) return;
    setSaving(true);
    try {
      const direction = delta > 0 ? '+' : '-';
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          amount: Math.abs(delta),
          currency: 'TRY',
          date: nowIstanbulISO(),
          method: 'Bakiye Düzeltme',
          notes: direction + (notes ? ' | ' + notes : ''),
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
        <div className="bg-teal-500 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">Bakiye Değiştirme</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
            Mevcut Bakiye: <span className="font-semibold text-slate-800">
              {currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY
            </span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Yeni Bakiye (TRY)</label>
            <input required type="number" step="0.01" value={targetBalance} onChange={e => setTargetBalance(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-right" />
            {delta !== null && delta !== 0 && (
              <p className={`text-xs mt-1 ${delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {delta > 0 ? `+${delta.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} borç eklenir` : `${Math.abs(delta).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} borç silinir`}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || delta === null || delta === 0}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾'} Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AlışModal ──────────────────────────────────────────────────────────────
type ItemType = 'product' | 'material';
type LineItem = { id: number; itemType: ItemType; refId: string; itemName: string; qty: string; unitPrice: string };

function AlışModal({ supplier, onClose, onSaved }: {
  supplier: any; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      invoiceNo: '',
      currency: supplier.currency || 'USD',
      notes: '',
    };
  });
  const [items, setItems] = useState<LineItem[]>([
    { id: 1, itemType: 'material', refId: '', itemName: '', qty: '1', unitPrice: '' },
  ]);
  const [productList, setProductList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [showNewItem, setShowNewItem] = useState<number | null>(null); // item.id
  const [newItemForm, setNewItemForm] = useState({ name: '', unitPrice: '', currency: 'TRY', pricePerKg: '' });
  const [saving, setSaving] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [subcontractorList, setSubcontractorList] = useState<any[]>([]);
  const [subcontractorId, setSubcontractorId] = useState('');


  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProductList(Array.isArray(d) ? d : []));
    fetch('/api/materials').then(r => r.json()).then(d => setMaterialList(Array.isArray(d) ? d : []));
    fetch('/api/subcontractors').then(r => r.json()).then(d => setSubcontractorList(Array.isArray(d) ? d : []));
  }, []);

  const closeDropdown = () => setOpenDropdown(null);

  const total = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * fromPriceInput(it.unitPrice), 0);

  const addRow = () => setItems(p => [...p, { id: Date.now(), itemType: 'material', refId: '', itemName: '', qty: '1', unitPrice: '' }]);
  const removeRow = (id: number) => setItems(p => p.filter(r => r.id !== id));
  const updateItem = (id: number, field: keyof LineItem, value: string) =>
    setItems(p => p.map(r => r.id === id ? { ...r, [field]: value } : r));
  const setItemType = (id: number, type: ItemType) =>
    setItems(p => p.map(r => r.id === id ? { ...r, itemType: type, refId: '', itemName: '' } : r));

  const selectRef = (itemId: number, ref: any, type: ItemType) => {
    const price = type === 'material' ? toPriceInput(ref.pricePerKg || '') : toPriceInput(ref.unitPrice || '');
    setItems(p => p.map(r => r.id === itemId
      ? { ...r, refId: ref.id, itemName: ref.name, unitPrice: price }
      : r));
    setOpenDropdown(null);
  };


  const filteredList = (item: LineItem) => {
    const list = item.itemType === 'material' ? materialList : productList;
    const q = item.itemName.toLowerCase();
    if (!q) return list.slice(0, 8);
    return list.filter((x: any) =>
      x.name.toLowerCase().includes(q) || (x.code && x.code.toLowerCase().includes(q))
    ).slice(0, 8);
  };

  const handleCreateItem = async (itemId: number, itemType: ItemType) => {
    if (!newItemForm.name) return;
    const price = itemType === 'material' ? newItemForm.pricePerKg : newItemForm.unitPrice;
    if (!price) return;
    setCreatingItem(true);
    try {
      let created: any;
      if (itemType === 'material') {
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newItemForm.name, pricePerKg: fromPriceInput(price), currency: newItemForm.currency }),
        });
        created = await res.json();
        setMaterialList(p => [...p, created]);
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newItemForm.name, unitPrice: fromPriceInput(price), currency: newItemForm.currency }),
        });
        created = await res.json();
        setProductList(p => [...p, created]);
      }
      selectRef(itemId, created, itemType);
      setNewItemForm({ name: '', unitPrice: '', currency: 'TRY', pricePerKg: '' });
      setShowNewItem(null);
    } finally { setCreatingItem(false); }
  };

  const validItems = items.filter(i => parseFloat(i.qty) > 0 && fromPriceInput(i.unitPrice) > 0);
  const canSavePurchase = validItems.length > 0 && total > 0;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSavePurchase) return;
    setSaving(true);
    try {
      const purchaseDateIso = new Date(`${form.date}T${form.time}`).toISOString();
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          invoiceNo: form.invoiceNo || null,
          date: purchaseDateIso,
          currency: form.currency,
          total,
          notes: form.notes || null,
          items: validItems.map(i => ({
            productId: i.itemType === 'product' ? (i.refId || null) : null,
            materialId: i.itemType === 'material' ? (i.refId || null) : null,
            subcontractorId: i.itemType === 'material' && subcontractorId ? subcontractorId : null,
            description: i.itemName,
            qty: i.qty,
            unitPrice: fromPriceInput(i.unitPrice),
          })),
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
          <div className="p-5 space-y-3 overflow-y-auto flex-1">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-800 font-medium truncate">
              {supplier.name}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'date')}</label>
                <div className="flex gap-2">
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
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
              <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm">
                <span className="font-semibold text-slate-700">{supplier.currency || 'USD'}</span>
                <span className="text-xs text-slate-400">(tedarikçi para birimi)</span>
              </div>
            </div>

            {subcontractorList.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Hedef Depo</label>
                <select value={subcontractorId} onChange={e => setSubcontractorId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="">Ana Depo</option>
                  {subcontractorList.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-slate-500">Kalemler</label>
                <button type="button" onClick={addRow}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Satır Ekle
                </button>
              </div>
              <div className="space-y-2">
                {items.map(item => {
                  const rowTotal = (parseFloat(item.qty) || 0) * fromPriceInput(item.unitPrice);
                  const fp = filteredList(item);
                  const isOpen = openDropdown === item.id;
                  const isMaterial = item.itemType === 'material';
                  return (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-2 space-y-2">
                      {/* Type toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex rounded-md overflow-hidden border border-slate-200 text-xs">
                          <button type="button"
                            onClick={() => setItemType(item.id, 'material')}
                            className={`px-2.5 py-1 font-medium transition-colors ${isMaterial ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                            Hammadde
                          </button>
                          <button type="button"
                            onClick={() => setItemType(item.id, 'product')}
                            className={`px-2.5 py-1 font-medium transition-colors ${!isMaterial ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                            Ürün
                          </button>
                        </div>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeRow(item.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                          </button>
                        )}
                      </div>
                      {/* Search input */}
                      <div className="relative flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <input
                          value={item.itemName}
                          onChange={e => {
                            updateItem(item.id, 'itemName', e.target.value);
                            updateItem(item.id, 'refId', '');
                            setOpenDropdown(item.id);
                          }}
                          onFocus={() => setOpenDropdown(item.id)}
                          onBlur={() => setTimeout(closeDropdown, 150)}
                          placeholder={isMaterial ? 'Hammadde ara veya yaz...' : 'Ürün ara veya yaz...'}
                          className="flex-1 text-sm outline-none"
                        />
                        {isOpen && fp.length > 0 && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 w-full max-h-40 overflow-y-auto">
                            {fp.map((ref: any) => (
                              <button key={ref.id} type="button"
                                onMouseDown={() => selectRef(item.id, ref, item.itemType)}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 flex items-center justify-between gap-2">
                                <span className="min-w-0">
                                  {ref.name}
                                  {ref.code && <span className="ml-1.5 text-xs text-slate-400 font-mono">{ref.code}</span>}
                                </span>
                                <span className="text-xs text-slate-400 flex-shrink-0">
                                  {isMaterial ? `${ref.pricePerKg} ${ref.currency}/kg` : `${ref.unitPrice} ${ref.currency}`}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-slate-400 mb-0.5 block">{isMaterial ? 'Miktar (kg)' : 'Miktar'}</label>
                          <input type="number" step="0.01" min="0.01" value={item.qty}
                            onChange={e => updateItem(item.id, 'qty', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-right outline-none focus:ring-1 focus:ring-indigo-400" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-0.5 block">{isMaterial ? 'Kg Fiyatı' : 'Birim Fiyat'}</label>
                          <input type="text" inputMode="decimal" value={item.unitPrice}
                            onChange={e => updateItem(item.id, 'unitPrice', normalizePriceInput(e.target.value))}
                            onKeyDown={blockDot}
                            className={`w-full px-2 py-1 border rounded text-right outline-none focus:ring-1 focus:ring-indigo-400 ${
                              parseFloat(item.qty) > 0 && !fromPriceInput(item.unitPrice)
                                ? 'border-orange-300 bg-orange-50'
                                : 'border-slate-200'
                            }`} />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-0.5 block">{t('supplierDetail', 'amount')}</label>
                          <div className="px-2 py-1 bg-slate-50 rounded text-right font-semibold text-slate-700">
                            {rowTotal > 0 ? rowTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </div>
                        </div>
                      </div>
                      {/* New item inline form */}
                      {showNewItem === item.id ? (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-indigo-700">
                            {isMaterial ? 'Yeni Hammadde Ekle (Kataloğa eklenecek)' : 'Yeni Ürün Ekle (Kataloğa eklenecek)'}
                          </p>
                          <input value={newItemForm.name} onChange={e => setNewItemForm(p => ({ ...p, name: e.target.value }))}
                            placeholder={isMaterial ? 'Hammadde adı' : 'Ürün adı'}
                            className="w-full px-2 py-1.5 border border-indigo-200 rounded text-sm outline-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" inputMode="decimal"
                              value={isMaterial ? newItemForm.pricePerKg : newItemForm.unitPrice}
                              onChange={e => { const v = normalizePriceInput(e.target.value); setNewItemForm(p => isMaterial ? { ...p, pricePerKg: v } : { ...p, unitPrice: v }); }}
                              onKeyDown={blockDot}
                              placeholder={isMaterial ? 'Kg fiyatı' : 'Birim fiyat'}
                              className="px-2 py-1.5 border border-indigo-200 rounded text-sm outline-none text-right" />
                            <select value={newItemForm.currency} onChange={e => setNewItemForm(p => ({ ...p, currency: e.target.value }))}
                              className="px-2 py-1.5 border border-indigo-200 rounded text-sm outline-none bg-white">
                              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setShowNewItem(null); setNewItemForm({ name: '', unitPrice: '', currency: 'TRY', pricePerKg: '' }); }}
                              className="flex-1 py-1 border border-slate-200 rounded text-xs text-slate-500 hover:bg-slate-50">{t('common', 'cancel')}</button>
                            <button type="button" onClick={() => handleCreateItem(item.id, item.itemType)}
                              disabled={creatingItem || !newItemForm.name || !(isMaterial ? newItemForm.pricePerKg : newItemForm.unitPrice)}
                              className="flex-1 py-1 bg-indigo-600 text-white rounded text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                              {creatingItem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Ekle
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setShowNewItem(item.id); setNewItemForm({ name: '', unitPrice: '', currency: 'TRY', pricePerKg: '' }); }}
                          className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                          Listede olmayan {isMaterial ? 'hammadde' : 'ürün'} eklemek için tıklayın
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Genel Toplam</span>
              <span className="text-lg font-bold text-slate-800">
                {total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.currency}
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

// ── Tedarikçi Çek Ödeme ────────────────────────────────────────────────────
const BANKS = [
  'Akbank', 'Garanti BBVA', 'İş Bankası', 'Yapı Kredi', 'Ziraat Bankası',
  'Halkbank', 'VakıfBank', 'DenizBank', 'QNB Finansbank', 'Fibabanka',
  'TEB', 'HSBC', 'ING', 'Şekerbank', 'Kuveyt Türk', 'Albaraka Türk', 'Diğer',
];
const fmtC = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function calcAvgVadeC(checks: any[]) {
  const total = checks.reduce((s, c) => s + Number(c.tutar), 0);
  if (!total) return null;
  const today = Date.now();
  const weightedDays = checks.reduce((s, c) => {
    return s + Number(c.tutar) * ((new Date(c.vadesi).getTime() - today) / 86400000);
  }, 0);
  const avgDays = Math.round(weightedDays / total);
  return { date: new Date(today + avgDays * 86400000), days: avgDays };
}

function KendiCekTanimModal({ supplierName, onClose, onAdd }: {
  supplierName: string; onClose: () => void; onAdd: (cek: any) => void;
}) {
  const [form, setForm] = useState({
    borclu: supplierName,
    islemTarihi: toDateInputValue(),
    vadesi: '',
    tutar: '',
    currency: 'TRY',
    seriNo: '',
    bankasi: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-teal-500 rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold">Çek Tanımı (Kendi Çekiniz)</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">İşlem Tarihi</label>
              <input type="date" value={form.islemTarihi} onChange={e => set('islemTarihi', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Vadesi *</label>
              <input type="date" value={form.vadesi} onChange={e => set('vadesi', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Borçlu</label>
            <input value={form.borclu} onChange={e => set('borclu', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Tutar *</label>
            <div className="flex gap-2">
              <input type="number" placeholder="0.00" value={form.tutar} onChange={e => set('tutar', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option>TRY</option><option>USD</option><option>EUR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Seri No</label>
            <input value={form.seriNo} onChange={e => set('seriNo', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Bankası</label>
            <select value={form.bankasi} onChange={e => set('bankasi', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option value="">Seçin</option>
              {BANKS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
            <button onClick={() => { if (!form.vadesi || !form.tutar) return; onAdd({ ...form, id: Math.random().toString(36).slice(2), _kendi: true }); onClose(); }}
              disabled={!form.vadesi || !form.tutar}
              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50">Tamam</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfoySecimModal({ onClose, onConfirm }: {
  onClose: () => void; onConfirm: (checks: any[], verilisTarihi: string) => void;
}) {
  const [cekler, setCekler] = useState<any[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [verilisTarihi, setVerilisTarihi] = useState(toDateInputValue());

  useEffect(() => {
    fetch('/api/cek?durum=PORTFOY&all=true')
      .then(r => r.json())
      .then(d => { setCekler(d.cekler || []); setLoadingC(false); });
  }, []);

  const toggle = (id: string) =>
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const filtered = cekler.filter(c =>
    `${c.borclu} ${c.seriNo || ''} ${c.tutar} ${c.customer?.name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="bg-teal-500 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold">Portföydeki Müşteri Çekleri</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Çeki Verdiğiniz Tarih</label>
            <input type="date" value={verilisTarihi} onChange={e => setVerilisTarihi(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Vereceğiniz çekleri seçin</label>
            <div className="relative">
              <button onClick={() => setDropOpen(o => !o)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white flex items-center justify-between hover:bg-slate-50">
                <span className="text-slate-600">
                  {selectedIds.length === 0 ? 'Çek seçin...' : `${selectedIds.length} çek seçildi`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {dropOpen && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 flex flex-col" style={{ maxHeight: 280 }}>
                  <div className="p-2 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2 px-2 py-1.5 border border-slate-200 rounded-lg">
                      <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Arama..."
                        className="outline-none text-sm flex-1" autoFocus />
                    </div>
                  </div>
                  <div className="overflow-y-auto">
                    {loadingC ? (
                      <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-teal-500 mx-auto" /></div>
                    ) : filtered.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-sm">Portföyde çek bulunamadı</div>
                    ) : filtered.map(c => {
                      const sel = selectedIds.includes(c.id);
                      return (
                        <div key={c.id} onClick={() => toggle(c.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${sel ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'}`}>
                          <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold ${sel ? 'border-white bg-white text-blue-600' : 'border-slate-300'}`}>
                            {sel && '✓'}
                          </div>
                          <span className="text-xs leading-tight">
                            {c.borclu}{c.customer?.name ? ` (${c.customer.name})` : ''} — {fmtDateC(c.vadesi)} — {fmtC(c.tutar)} {c.currency} No:{c.seriNo || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={() => { const sel = cekler.filter(c => selectedIds.includes(c.id)); onConfirm(sel, verilisTarihi); onClose(); }}
            disabled={selectedIds.length === 0}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}

function TedarikciCekModal({ supplier, onClose, onSaved }: {
  supplier: any; onClose: () => void; onSaved: () => void;
}) {
  const [kendiCekler, setKendiCekler] = useState<any[]>([]);
  const [portfoyCekler, setPortfoyCekler] = useState<any[]>([]);
  const [fxAmounts, setFxAmounts] = useState<Record<string, string>>({});
  const [aciklama, setAciklama] = useState('');
  const [showKendiTanim, setShowKendiTanim] = useState(false);
  const [showPortfoy, setShowPortfoy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleKey, setToggleKey] = useState(0);
  const [showToggle, setShowToggle] = useState(false);

  const allChecks = [...kendiCekler, ...portfoyCekler];
  const totalTutar = allChecks.reduce((s, c) => s + Number(c.tutar), 0);
  const avgVade = calcAvgVadeC(allChecks);

  // Re-animate toggle on every change
  useEffect(() => {
    if (allChecks.length > 0) {
      setShowToggle(true);
      setToggleKey(k => k + 1);
    } else {
      setShowToggle(false);
    }
  }, [allChecks.length, totalTutar]); // eslint-disable-line

  const removeCheck = (id: string) => {
    setKendiCekler(p => p.filter(c => c.id !== id));
    setPortfoyCekler(p => p.filter(c => c.id !== id));
  };

  const handlePortfoyConfirm = (checks: any[], verilisTarihi: string) => {
    const withDate = checks.map(c => ({ ...c, _portfoy: true, _verilisTarihi: verilisTarihi }));
    setPortfoyCekler(prev => {
      const existingIds = prev.map(c => c.id);
      return [...prev, ...withDate.filter(c => !existingIds.includes(c.id))];
    });
  };

  const handleSave = async () => {
    if (!allChecks.length) return;
    setSaving(true);
    try {
      await Promise.all([
        // Kendi çekleri → çek kaydı oluştur + ödeme kaydı
        ...kendiCekler.map(c =>
          fetch('/api/cek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: supplier.id,
              borclu: c.borclu,
              islem: 'Tedarikçiye Verilen Çek Kaydı',
              aciklama: aciklama || null,
              islemTarihi: c.islemTarihi,
              vadesi: c.vadesi,
              tutar: parseFloat(c.tutar),
              currency: c.currency,
              seriNo: c.seriNo || null,
              bankasi: c.bankasi || null,
            }),
          })
        ),
        // Kendi çekleri → ödeme kaydı (bakiye düşsün)
        ...kendiCekler.map(c => {
          const fxAmt = fxAmounts[c.id] ? parseFloat(fxAmounts[c.id]) : 0;
          const hasFx = supplier.currency !== 'TRY' && fxAmt > 0;
          return fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: supplier.id,
              amount: hasFx ? fxAmt : parseFloat(c.tutar),
              currency: hasFx ? supplier.currency : (c.currency || 'TRY'),
              ...(hasFx ? {
                originalAmount: parseFloat(c.tutar),
                originalCurrency: c.currency || 'TRY',
              } : {}),
              date: c.islemTarihi,
              method: 'Çek',
              notes: [
                c.seriNo ? `Çek No: ${c.seriNo}` : '',
                c.bankasi ? `Banka: ${c.bankasi}` : '',
                `Vade: ${fmtDateC(c.vadesi)}`,
                aciklama,
              ].filter(Boolean).join(' | '),
            }),
          });
        }),
        // Portföy çekleri → durumu güncelle + ödeme kaydı
        ...portfoyCekler.map(c =>
          fetch(`/api/cek/${c.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              durum: 'TEDARIKCI_VERILDI',
              supplierId: supplier.id,
              islemTarihi: new Date(c._verilisTarihi || Date.now()),
              aciklama: aciklama || null,
            }),
          })
        ),
        ...portfoyCekler.map(c => {
          const fxAmt = fxAmounts[c.id] ? parseFloat(fxAmounts[c.id]) : 0;
          const hasFx = supplier.currency !== 'TRY' && fxAmt > 0;
          return fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: supplier.id,
              amount: hasFx ? fxAmt : parseFloat(c.tutar),
              currency: hasFx ? supplier.currency : (c.currency || 'TRY'),
              ...(hasFx ? {
                originalAmount: parseFloat(c.tutar),
                originalCurrency: c.currency || 'TRY',
              } : {}),
              date: c._verilisTarihi || toDateInputValue(),
              method: 'Çek',
              notes: [
                c.seriNo ? `Çek No: ${c.seriNo}` : '',
                c.bankasi ? `Banka: ${c.bankasi}` : '',
                `Vade: ${fmtDateC(c.vadesi)}`,
                c.borclu ? `Sahibi: ${c.borclu}` : '',
                aciklama,
              ].filter(Boolean).join(' | '),
            }),
          });
        }),
      ]);
      onSaved();
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* Floating toggle — top-left */}
      {showToggle && (
        <div key={toggleKey}
          className="fixed top-4 left-4 z-[100] bg-white border border-teal-300 rounded-xl shadow-xl px-4 py-3 min-w-[200px] animate-in slide-in-from-left duration-300">
          <p className="text-xs font-semibold text-teal-700 mb-0.5">
            Toplam: {fmtC(totalTutar)} TL
          </p>
          {avgVade && (
            <p className="text-xs text-slate-500">
              Ort. Vade: {fmtDateC(avgVade.date)} ({avgVade.days} gün)
            </p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{allChecks.length} çek seçili</p>
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="bg-blue-600 rounded-t-2xl px-6 py-4 flex items-center justify-between flex-shrink-0">
            <h2 className="text-white font-bold flex items-center gap-2">
              Tedarikçiye Çek Ödemesi — {supplier.name}
            </h2>
            <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Buttons */}
            <div className="flex gap-3">
              <button onClick={() => setShowKendiTanim(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Yeni Çek Ekle (kendi çekiniz)
              </button>
              <button onClick={() => setShowPortfoy(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Müşteri Çeki Ekle (portföyden)
              </button>
            </div>

            {/* Check table */}
            {allChecks.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Çek Tutarı</th>
                      <th className="px-3 py-2 text-left">Döviz Karşılığı</th>
                      <th className="px-3 py-2 text-left">Vade</th>
                      <th className="px-3 py-2 text-left">Sahibi</th>
                      <th className="px-3 py-2 text-left">Banka</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allChecks.map(c => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{fmtC(Number(c.tutar))} {c.currency}</td>
                        <td className="px-3 py-2">
                          {supplier.currency !== 'TRY' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number" step="0.01" placeholder="0.00"
                                value={fxAmounts[c.id] || ''}
                                onChange={e => setFxAmounts(r => ({ ...r, [c.id]: e.target.value }))}
                                className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right outline-none focus:ring-1 focus:ring-teal-400"
                              />
                              <span className="text-xs font-semibold px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 select-none cursor-default">
                                {supplier.currency}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-700">{fmtC(Number(c.tutar))}</span>
                              <span className="text-xs text-slate-400">{c.currency || 'TRY'}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{fmtDateC(c.vadesi)}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs max-w-[120px] truncate">{c.borclu}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{c.bankasi || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeCheck(c.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Summary */}
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap gap-6 text-sm">
                  <div><span className="text-slate-500 font-medium">Toplam Tutar: </span><span className="font-bold">{fmtC(totalTutar)} TL</span></div>
                  {avgVade && (
                    <div><span className="text-slate-500 font-medium">Ortalama Vade: </span>
                      <span className="font-bold">{fmtDateC(avgVade.date)} ({avgVade.days} gün)</span></div>
                  )}
                </div>
              </div>
            )}

            {allChecks.length === 0 && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-10 text-center text-slate-400 text-sm">
                Henüz çek eklenmedi
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Açıklama</label>
              <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
          </div>

          <div className="flex gap-3 p-5 border-t flex-shrink-0">
            <button onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving || allChecks.length === 0}
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Kaydet
            </button>
          </div>
        </div>
      </div>

      {showKendiTanim && (
        <KendiCekTanimModal
          supplierName={supplier.name}
          onClose={() => setShowKendiTanim(false)}
          onAdd={cek => setKendiCekler(p => [...p, cek])}
        />
      )}
      {showPortfoy && (
        <PortfoySecimModal
          onClose={() => setShowPortfoy(false)}
          onConfirm={handlePortfoyConfirm}
        />
      )}
    </>
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
  const [deleting, setDeleting] = useState(false);
  const [showAlıs, setShowAlıs] = useState(false);
  const [showOdeme, setShowOdeme] = useState(false);
  const [showIade, setShowIade] = useState(false);
  const [showBorcFis, setShowBorcFis] = useState(false);
  const [showBakiyeDuzelt, setShowBakiyeDuzelt] = useState(false);
  const [showTedarikciCek, setShowTedarikciCek] = useState(false);
  const [odemeDropdown, setOdemeDropdown] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [cekPortfoyToast, setCekPortfoyToast] = useState(false);
  const [purchasesShown, setPurchasesShown] = useState(10);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
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

  const handleDeleteSupplier = async () => {
    if (Math.abs(supplier.balance ?? 0) > 0.01) {
      alert(`Bu tedarikçinin ${supplier.balance?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${supplier.currency} açık bakiyesi var.\n\nSilmeden önce bakiyeyi sıfırlayın.`);
      return;
    }
    if (!confirm(`"${supplier.name}" adlı tedarikçi kalıcı olarak silinecek. Tüm geçmişi (alış, ödeme vb.) ile birlikte silinir.\n\nEmin misiniz?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) router.push('/suppliers');
  };

  const handleDeletePayment = async (id: string, method?: string) => {
    const isCek = method === 'Çek';
    const msg = isCek
      ? 'Bu çek ödemesi silinecek ve çek portföye geri dönecek. Emin misiniz?'
      : 'Bu ödeme silinecek. Emin misiniz?';
    if (!confirm(msg)) return;
    await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    if (isCek) {
      setCekPortfoyToast(true);
      setTimeout(() => setCekPortfoyToast(false), 3500);
    }
    load();
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
      if (tx.debit > 0) doc.text(tx.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), W - M - 50, y, { align: 'right' });
      if (tx.credit > 0) doc.text(tx.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), W - M - 20, y, { align: 'right' });
      doc.text(balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), W - M, y, { align: 'right' });
      y += 6;
      doc.setDrawColor(230, 230, 230); doc.line(M, y - 1, W - M, y - 1);
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(W - M - 80, y - 4, 80, 8, 'F');
    doc.text('NET BAKIYE:', W - M - 60, y);
    doc.text(balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), W - M, y, { align: 'right' });

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
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Para Birimi</label>
                  <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{supplier.currency || 'USD'}</span>
                    <span className="text-xs text-slate-400">(değiştirilemez)</span>
                  </div>
                </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">{supplier.currency || 'USD'}</span>
                  </div>
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
            <p className="text-2xl font-bold">{(supplier.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">Borç</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl p-4 text-white bg-blue-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('supplierDetail', 'totalPurchased')}</p>
            <p className="text-2xl font-bold">{(supplier.totalPurchased || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">{(supplier.purchases || []).length} alış</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-xl p-4 text-white bg-teal-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">{t('supplierDetail', 'totalPaid')}</p>
            <p className="text-2xl font-bold">{(supplier.totalPaid || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">{(supplier.payments || []).length} ödeme</p>
          </motion.div>
        </div>

        {/* Çek portföy toast */}
        {cekPortfoyToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-cyan-600 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
            <span className="text-lg">✓</span>
            <div>
              <p className="font-semibold text-sm">Çek Portföye Döndürüldü</p>
              <p className="text-xs text-cyan-100">Çek portföy ekranında görüntülenebilir</p>
            </div>
          </div>
        )}

        {/* Success overlay */}
        {successAmount !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto border border-teal-200 animate-in fade-in zoom-in duration-200">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-teal-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">Ödeme Tamamlandı</p>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">{successAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY</span> ödendi
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
          <div className="relative">
            <button
              onClick={() => setOdemeDropdown(d => !d)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Banknote className="w-4 h-4" /> Ödeme/Tahsilat <ChevronDown className="w-3 h-3" />
            </button>
            {odemeDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOdemeDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[200px] overflow-hidden">
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowOdeme(true); setOdemeDropdown(false); }}>
                    <Banknote className="w-4 h-4 text-teal-500" /> Nakit / KK / Banka
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowTedarikciCek(true); setOdemeDropdown(false); }}>
                    <FileText className="w-4 h-4 text-indigo-500" /> Çek
                  </button>
                  <hr className="border-slate-100" />
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowBorcFis(true); setOdemeDropdown(false); }}>
                    <FileText className="w-4 h-4 text-teal-500" /> Borç/Alacak Fişi
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowBakiyeDuzelt(true); setOdemeDropdown(false); }}>
                    <PlusCircle className="w-4 h-4 text-slate-500" /> Bakiye Düzelt
                  </button>
                </div>
              </>
            )}
          </div>
          <Link href={`/suppliers/${params.id}/ekstre`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Download className="w-4 h-4" /> {t('supplierDetail', 'accountStatement')}
          </Link>
          <button
            onClick={handleDeleteSupplier}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Tedarikçiyi Sil
          </button>
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
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-4 py-2 text-left">{t('supplierDetail', 'date')}</th>
                    <th className="px-4 py-2 text-left">{t('supplierDetail', 'invoiceNo')}</th>
                    <th className="px-4 py-2 text-right">{t('supplierDetail', 'amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.purchases.slice(0, purchasesShown).map((p: any) => {
                    const isOpen = expandedPurchaseId === p.id;
                    const remaining = p.total - p.paidAmount;
                    const statusLabel = remaining <= 0 ? 'Faturalaşmış' : remaining < p.total ? 'Kısmi' : 'Bekliyor';
                    const statusColor = remaining <= 0 ? 'text-emerald-600' : remaining < p.total ? 'text-blue-600' : 'text-orange-500';
                    return (
                      <>
                        <tr key={p.id}
                          onClick={() => setExpandedPurchaseId(isOpen ? null : p.id)}
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${isOpen ? 'bg-slate-50' : 'hover:bg-teal-50/30'}`}>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 text-xs font-bold ${isOpen ? 'border-slate-500 text-slate-600 bg-slate-100' : 'border-slate-400 text-slate-500'}`}>
                              {isOpen ? '−' : '+'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                            {new Date(p.date).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-teal-600">{p.invoiceNo || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                            {p.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${p.id}-exp`} className="border-b border-slate-200">
                            <td colSpan={4} className="px-4 py-3 bg-slate-50">
                              {p.purchaseMaterials && p.purchaseMaterials.length > 0 && (
                                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden mb-3">
                                  <thead>
                                    <tr className="bg-white border-b border-slate-200">
                                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Ürün/Hizmet</th>
                                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Fiyat</th>
                                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Tutar (KDV Dahil)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {p.purchaseMaterials.map((pm: any) => {
                                      const tutar = (pm.kgAmount ?? 0) * (pm.pricePerKg ?? 0);
                                      return (
                                        <tr key={pm.id}>
                                          <td className="px-3 py-2 text-slate-700">
                                            <span className="text-slate-400 mr-1">{pm.kgAmount} kg</span>
                                            {pm.material?.name}
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-600">
                                            {pm.pricePerKg ? pm.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-800">
                                            {tutar > 0 ? tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                              <div className="flex gap-2 flex-wrap">
                                <Link href={`/purchases/${p.id}`} onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors">
                                  Alış ekranına git ↗
                                </Link>
                                <Link href={`/purchases/${p.id}`} onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors">
                                  Yazdır
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
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
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplier.payments.slice(0, paymentsShown).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 group">
                      <td className="px-4 py-2.5 text-slate-500">{new Date(p.date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-teal-600">
                        {p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {p.method}{p.notes ? ` (${p.notes})` : ''}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button onClick={() => handleDeletePayment(p.id, p.method)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
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
      {showTedarikciCek && (
        <TedarikciCekModal
          supplier={supplier}
          onClose={() => setShowTedarikciCek(false)}
          onSaved={() => { setShowTedarikciCek(false); load(); }}
        />
      )}
      {showBorcFis && (
        <BorcAlacakFisModal
          supplier={supplier}
          onClose={() => setShowBorcFis(false)}
          onSaved={() => { setShowBorcFis(false); load(); }}
        />
      )}
      {showBakiyeDuzelt && (
        <BakiyeDuzeltModal
          supplier={supplier}
          currentBalance={supplier.balance ?? 0}
          onClose={() => setShowBakiyeDuzelt(false)}
          onSaved={() => { setShowBakiyeDuzelt(false); load(); }}
        />
      )}
    </AppShell>
  );
}
