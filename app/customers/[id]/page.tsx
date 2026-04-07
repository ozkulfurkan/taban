'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  ArrowLeft, Loader2, Pencil, FileText, ShoppingCart, Download, RotateCcw,
  Phone, Mail, MapPin, Hash, Save, X, User, ChevronRight, Building2, CheckCircle2, Banknote,
  ChevronDown, PlusCircle, Trash2, CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, toDateInputValue } from '@/lib/time';
import { useLanguage } from '@/lib/i18n/language-context';

function nowIstanbulISO(): string {
  const now = new Date();
  const istanbul = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return istanbul.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM Istanbul time
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

function TahsilatModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: (amount: number) => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    accountId: '',
    paymentCurrency: customer.currency || 'TRY',
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
    if (form.paymentCurrency === (customer.currency || 'TRY')) {
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

  const isSameCurrency = form.paymentCurrency === (customer.currency || 'TRY');
  const amt = parseFloat(form.amount) || 0;
  const finalRecorded = isSameCurrency ? amt : (parseFloat(form.recordedAmount) || 0);

  // Tutar changes → recompute Kaydedilecek Tutar
  const handleAmountChange = (v: string) => {
    const a = parseFloat(v) || 0;
    const r = parseFloat(form.exchangeRate) || 0;
    setForm(p => ({ ...p, amount: v, recordedAmount: (!isSameCurrency && r > 0 && a > 0) ? String(a * r) : p.recordedAmount }));
  };

  // Kur changes → recompute Kaydedilecek Tutar
  const handleRateChange = (v: string) => {
    const r = parseFloat(v) || 0;
    setForm(p => ({ ...p, exchangeRate: v, recordedAmount: (amt > 0 && r > 0) ? String(amt * r) : p.recordedAmount }));
  };

  // Kaydedilecek Tutar changes → recompute Kur
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
          customerId: customer.id,
          accountId: form.accountId,
          amount: savedAmt,
          currency: customer.currency || 'TRY',
          originalAmount: isSameCurrency ? null : amt,
          originalCurrency: isSameCurrency ? null : form.paymentCurrency,
          exchangeRate: isSameCurrency ? null : parseFloat(form.exchangeRate) || null,
          date: nowIstanbulISO(),
          method: form.method,
          notes,
        }),
      });
      onSaved(savedAmt);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const canSave = !!form.accountId && amt > 0 && (isSameCurrency || finalRecorded > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="bg-emerald-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">{t('customerDetail', 'collect')}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800 font-medium truncate">
            {customer.name}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'account')}</label>
            <select required value={form.accountId} onChange={e => set('accountId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white ${!form.accountId ? 'border-orange-300 bg-orange-50' : 'border-slate-200'}`}>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'amount')}</label>
              <input required type="number" step="0.01" min="0.01" value={form.amount} onChange={e => handleAmountChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-right" />
            </div>
          </div>
          {!isSameCurrency && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    {t('modal', 'rate')} (1 {form.paymentCurrency}={customer.currency || 'TRY'})
                  </label>
                  <input type="number" step="0.0000000001" min="0.0000000001" value={form.exchangeRate}
                    onChange={e => handleRateChange(e.target.value)} placeholder="0.0000"
                    className="w-full px-2 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    {t('modal', 'recordedAmount')} ({customer.currency || 'TRY'}) *
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('modal', 'notes')}</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common', 'cancel')}</button>
            <button type="submit" disabled={saving || !canSave}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IadeModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ amount: '', method: 'Nakit', notes: 'İade' });
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
          customerId: customer.id,
          amount: form.amount,
          currency: 'TRY',
          date: nowIstanbulISO(),
          method: form.method,
          notes: form.notes,
        }),
      });
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
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
            <input required type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('customerDetail', 'method')}</label>
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
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">{t('common', 'cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BorcAlacakFisModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
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
          customerId: customer.id,
          amount: parseFloat(form.amount),
          currency: customer.currency || 'TRY',
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
            Herhangi bir tahsilat, ödeme, satış ya da iade işlemi olmadan müşterinizin bakiyesini değiştirmek için borç ya da alacak fişi kaydı oluşturabilirsiniz. Müşterinizin güncel borç bakiyesi burada gireceğiniz tutar kadar değişecek ve ekstresine yansıyacaktır.
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">İşlem Tipi</label>
            <select value={form.tip} onChange={e => set('tip', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
              <option>Alacak Fişi</option>
              <option>Borç Fişi</option>
            </select>
            <p className="text-xs mt-1 text-slate-400">
              {form.tip === 'Borç Fişi' ? 'müşteri borçlanacak' : 'müşteri alacaklanacak'}
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

function BakiyeDuzeltModal({ customer, currentBalance, onClose, onSaved }: {
  customer: any; currentBalance: number; onClose: () => void; onSaved: () => void;
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
          customerId: customer.id,
          amount: Math.abs(delta),
          currency: customer.currency || 'TRY',
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
              {currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {customer.currency || 'TRY'}
            </span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Yeni Bakiye ({customer.currency || 'TL'})
            </label>
            <input required type="number" step="0.01" value={targetBalance} onChange={e => setTargetBalance(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-right" />
            {delta !== null && delta !== 0 && (
              <p className={`text-xs mt-1 ${delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {delta > 0 ? `+${delta.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} borç eklenir` : `${Math.abs(delta).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} borç silinir`}
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

const ISLEM_OPTIONS = [
  'Müşteriden Alınan Çek Kaydı',
  'Müşteriye Verilen Çek Kaydı',
  'Diğer',
];

const BANKS = [
  'Akbank', 'Garanti BBVA', 'İş Bankası', 'Yapı Kredi', 'Ziraat Bankası',
  'Halkbank', 'VakıfBank', 'DenizBank', 'QNB Finansbank', 'Fibabanka',
  'TEB', 'HSBC', 'ING', 'Şekerbank', 'Kuveyt Türk', 'Albaraka Türk', 'Diğer',
];

const fmtDate = formatDate;
const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

function calcAvgVade(checks: any[]) {
  const total = checks.reduce((s, c) => s + Number(c.tutar), 0);
  if (!total) return null;
  const today = Date.now();
  const weightedDays = checks.reduce((s, c) => {
    const daysToVade = (new Date(c.vadesi).getTime() - today) / 86400000;
    return s + Number(c.tutar) * daysToVade;
  }, 0);
  const avgDays = Math.round(weightedDays / total);
  const avgDate = new Date(today + avgDays * 86400000);
  return { date: avgDate, days: avgDays };
}

function CekTanimModal({ borclu: defaultBorclu, onClose, onAdd }: { borclu: string; onClose: () => void; onAdd: (cek: any) => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    borclu: defaultBorclu,
    islemTarihi: toDateInputValue(),
    vadesi: '',
    tutar: '',
    currency: 'TRY',
    seriNo: '',
    bankasi: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.vadesi || !form.tutar) return;
    onAdd({ ...form, id: Math.random().toString(36).slice(2) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-teal-500 rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold text-base">Çek Tanımı</h3>
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
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500">
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Seçin</option>
              {BANKS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">{t('common', 'cancel')}</button>
            <button onClick={handleAdd} disabled={!form.vadesi || !form.tutar}
              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50">Tamam</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CekKayitModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [islem, setIslem] = useState(ISLEM_OPTIONS[0]);
  const [aciklama, setAciklama] = useState('');
  const [checks, setChecks] = useState<any[]>([]);
  const [showTanim, setShowTanim] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalTutar = checks.reduce((s, c) => s + parseFloat(c.tutar), 0);
  const avgVade = calcAvgVade(checks);

  const handleSave = async () => {
    if (!checks.length) return;
    setSaving(true);
    try {
      await Promise.all(checks.map(c =>
        fetch('/api/cek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.id,
            borclu: c.borclu,
            islem,
            aciklama: aciklama || null,
            islemTarihi: c.islemTarihi,
            vadesi: c.vadesi,
            tutar: parseFloat(c.tutar),
            currency: c.currency,
            seriNo: c.seriNo || null,
            bankasi: c.bankasi || null,
          }),
        })
      ));
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="bg-teal-600 rounded-t-2xl px-6 py-4 flex items-center justify-between flex-shrink-0">
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Çek Kaydı — {customer.name}
            </h2>
            <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* İşlem + Açıklama */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">İşlem</label>
                <select value={islem} onChange={e => setIslem(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500">
                  {ISLEM_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Açıklama</label>
                <input value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="İsteğe bağlı"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>

            {/* Yeni Çek Ekle */}
            <button onClick={() => setShowTanim(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
              <PlusCircle className="w-4 h-4" /> {t('customerDetail', 'addCheck')}
            </button>

            {/* Check list */}
            {checks.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('customerDetail', 'amount')}</th>
                      <th className="px-3 py-2 text-left">Vade</th>
                      <th className="px-3 py-2 text-left">Banka</th>
                      <th className="px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-center">Sil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map(c => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{fmt(parseFloat(c.tutar))} {c.currency}</td>
                        <td className="px-3 py-2 text-slate-500">{fmtDate(c.vadesi)}</td>
                        <td className="px-3 py-2 text-slate-500">{c.bankasi || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{c.seriNo || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setChecks(prev => prev.filter(x => x.id !== c.id))}
                            className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Totals */}
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap gap-6 text-sm">
                  <div><span className="text-slate-500 font-medium">Toplam Tutar: </span><span className="font-bold">{fmt(totalTutar)} TL</span></div>
                  {avgVade && (
                    <div>
                      <span className="text-slate-500 font-medium">Ortalama Vade: </span>
                      <span className="font-bold">{fmtDate(avgVade.date)} ({avgVade.days} gün)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {checks.length === 0 && (
              <div className="bg-amber-50 rounded-lg px-4 py-3 text-sm text-amber-700">
                Çek eklemek için yukarıdaki düğmeye tıklayın
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">{t('common', 'cancel')}</button>
            <button onClick={handleSave} disabled={saving || checks.length === 0}
              className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common', 'save')}
            </button>
          </div>
        </div>
      </div>

      {showTanim && (
        <CekTanimModal
          borclu={customer.name}
          onClose={() => setShowTanim(false)}
          onAdd={cek => { setChecks(prev => [...prev, cek]); }}
        />
      )}
    </>
  );
}

export default function CustomerDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showIade, setShowIade] = useState(false);
  const [showTahsilat, setShowTahsilat] = useState(false);
  const [showCek, setShowCek] = useState(false);
  const [showBorcFis, setShowBorcFis] = useState(false);
  const [showBakiyeDuzelt, setShowBakiyeDuzelt] = useState(false);
  const [tahsilatDropdown, setTahsilatDropdown] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [cekPortfoyToast, setCekPortfoyToast] = useState(false);
  const [invoicesShown, setInvoicesShown] = useState(10);
  const [paymentsShown, setPaymentsShown] = useState(10);
  const [cekler, setCekler] = useState<any[]>([]);

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
    Promise.all([
      fetch(`/api/customers/${params.id}`).then(r => r.json()),
      fetch(`/api/cek?customerId=${params.id}&all=true`).then(r => r.json()),
    ])
      .then(([d, cekData]) => {
        setCustomer(d);
        setForm(d);
        setCekler(cekData.cekler || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [params?.id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/customers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setCustomer((prev: any) => ({ ...prev, ...form }));
    setEditing(false);
    setSaving(false);
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
    if (!customer) return;

    const tr = (s: string) => (s || '').toString()
      .replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const M = 15;
    let y = M;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(tr(customer.name), M, 10);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('HESAP EKSTRESI', M, 17);
    doc.text(new Date().toLocaleDateString('tr-TR'), W - M, 17, { align: 'right' });

    y = 32;
    doc.setTextColor(30,30,30);

    // Build combined transactions sorted by date
    const txns: any[] = [
      ...(customer.invoices || []).map((inv: any) => ({ date: inv.date, label: `Fatura: ${inv.invoiceNo}`, debit: inv.total, credit: 0, status: STATUS_LABEL[inv.status] })),
      ...(customer.payments || []).map((p: any) => ({ date: p.date, label: `Odeme: ${p.method}${p.notes ? ' - ' + p.notes : ''}`, debit: 0, credit: p.amount })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Table header
    doc.setFillColor(241,245,249);
    doc.rect(M, y - 4, W - 2*M, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80);
    doc.text('TARIH', M+1, y); doc.text('ISLEM', M+25, y);
    doc.text('BORC', W-M-50, y, { align: 'right' });
    doc.text('ALACAK', W-M-20, y, { align: 'right' });
    doc.text('BAKIYE', W-M, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,30,30);
    let balance = 0;
    txns.forEach(tx => {
      balance += tx.debit - tx.credit;
      doc.text(new Date(tx.date).toLocaleDateString('tr-TR'), M+1, y);
      const label = tr(tx.label).substring(0, 40);
      doc.text(label, M+25, y);
      if (tx.debit > 0) doc.text(tx.debit.toLocaleString('tr-TR',{minimumFractionDigits:2}), W-M-50, y, {align:'right'});
      if (tx.credit > 0) doc.text(tx.credit.toLocaleString('tr-TR',{minimumFractionDigits:2}), W-M-20, y, {align:'right'});
      doc.text(balance.toLocaleString('tr-TR',{minimumFractionDigits:2}), W-M, y, {align:'right'});
      y += 6;
      doc.setDrawColor(230,230,230); doc.line(M, y-1, W-M, y-1);
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.setFillColor(241,245,249);
    doc.rect(W-M-80, y-4, 80, 8, 'F');
    doc.text('NET BAKIYE:', W-M-60, y);
    doc.text(balance.toLocaleString('tr-TR',{minimumFractionDigits:2}), W-M, y, {align:'right'});

    doc.save(`${tr(customer.name)}_Hesap_Ekstresi.pdf`);
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  if (!customer || customer.error) return <AppShell><div className="text-center py-12 text-slate-400">Müşteri bulunamadı</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Müşteriler
        </button>

        {/* Customer Info Card (BizimHesap style) */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['name','Firma Adı'], ['taxId','VKN'], ['taxOffice','Vergi Dairesi'], ['phone','Telefon'], ['email','E-posta']].map(([f, l]) => (
                  <div key={f}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input value={form[f] ?? ''} onChange={e => setForm((p: any) => ({...p, [f]: e.target.value}))}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Para Birimi</label>
                  <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{customer.currency || 'TRY'}</span>
                    <span className="text-xs text-slate-400">(değiştirilemez)</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Adres</label>
                  <textarea value={form.address ?? ''} onChange={e => setForm((p: any) => ({...p, address: e.target.value}))}
                    rows={2} className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none bg-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notlar</label>
                  <textarea value={form.notes ?? ''} onChange={e => setForm((p: any) => ({...p, notes: e.target.value}))}
                    rows={2} className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none bg-white" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{t('common', 'cancel')}</button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t('common', 'save')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-800 mb-1">{customer.name}</h1>
                <div className="space-y-1 text-sm text-slate-600">
                  {customer.currency && <div className="flex items-center gap-2"><span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{customer.currency}</span></div>}
                  {customer.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{customer.email}</div>}
                  {customer.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />{customer.address}</div>}
                  {(customer.taxId || customer.taxOffice) && (
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-slate-400" />
                      {customer.taxId && <span>VKN: {customer.taxId}</span>}
                      {customer.taxOffice && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" />{customer.taxOffice}</span>}
                    </div>
                  )}
                  {customer.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{customer.phone}</div>}
                  {customer.notes && <p className="text-xs text-slate-400 italic mt-1">{customer.notes}</p>}
                </div>
              </>
            )}
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="p-2 hover:bg-amber-100 rounded-lg transition-colors flex-shrink-0">
              <Pencil className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>

        {/* Balance Cards */}
        {(() => {
          const cekBakiye = cekler
            .filter(c => c.durum === 'PORTFOY' || c.durum === 'BANKAYA_VERILDI')
            .reduce((s, c) => s + c.tutar, 0);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl p-4 text-white bg-orange-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">{t('customerDetail', 'balance')}</p>
                <p className="text-xl font-bold">{(customer.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs opacity-70 mt-0.5">{customer.currency || 'TRY'}</p>
              </div>
              <div className="rounded-xl p-4 text-white bg-blue-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">{t('customerDetail', 'totalInvoiced')}</p>
                <p className="text-xl font-bold">{(customer.totalInvoiced || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs opacity-70 mt-0.5">{(customer.invoices || []).length} fatura</p>
              </div>
              <div className="rounded-xl p-4 text-white bg-teal-500 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">{t('customerDetail', 'totalPaid')}</p>
                <p className="text-xl font-bold">{(customer.totalPaid || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs opacity-70 mt-0.5">{(customer.payments || []).length} ödeme</p>
              </div>
              <div className="rounded-xl p-4 text-white bg-cyan-600 shadow-sm">
                <p className="text-xs font-medium opacity-80 mb-1">Çek Bakiyesi</p>
                <p className="text-xl font-bold">{cekBakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs opacity-70 mt-0.5">{cekler.filter(c => c.durum === 'PORTFOY' || c.durum === 'BANKAYA_VERILDI').length} çek</p>
              </div>
            </div>
          );
        })()}

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
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto border border-emerald-200 animate-in fade-in zoom-in duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">Ödeme Tamamlandı</p>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">{successAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {customer.currency || 'TRY'}</span> tahsil edildi
              </p>

              <button onClick={() => setSuccessAmount(null)} className="mt-1 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                Tamam
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/invoices/new?customerId=${customer.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" /> {t('customerDetail', 'newSale')}
          </Link>
          <Link
            href={`/quotes/new?customerId=${customer.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" /> Teklif Hazırla
          </Link>
          <Link
            href={`/invoices/return?customerId=${customer.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" /> {t('customerDetail', 'returnInvoice')}
          </Link>
          <div className="relative">
            <button
              onClick={() => setTahsilatDropdown(d => !d)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Banknote className="w-4 h-4" /> Tahsilat/Ödeme <ChevronDown className="w-3 h-3" />
            </button>
            {tahsilatDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTahsilatDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[200px] overflow-hidden">
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowTahsilat(true); setTahsilatDropdown(false); }}>
                    <Banknote className="w-4 h-4 text-emerald-500" /> Nakit / KK / Banka
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowCek(true); setTahsilatDropdown(false); }}>
                    <CreditCard className="w-4 h-4 text-teal-500" /> Çek
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-50 cursor-not-allowed"
                    onClick={() => setTahsilatDropdown(false)}>
                    <FileText className="w-4 h-4" /> Senet (yakında)
                  </button>
                  <hr className="border-slate-100" />
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowBorcFis(true); setTahsilatDropdown(false); }}>
                    <FileText className="w-4 h-4 text-teal-500" /> Borç/Alacak Fişi
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => { setShowBakiyeDuzelt(true); setTahsilatDropdown(false); }}>
                    <PlusCircle className="w-4 h-4 text-slate-500" /> Bakiye Düzelt
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowIade(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" /> {t('modal', 'returnTitle')}
          </button>
          <Link href={`/customers/${params.id}/ekstre`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> {t('customerDetail', 'accountStatement')}
          </Link>
        </div>

        {/* Previous Sales + Previous Payments (side by side) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-700">
              <h2 className="font-semibold text-white text-sm uppercase tracking-wide">{t('customerDetail', 'previousSales')}</h2>
              <Link href={`/invoices?customerId=${customer.id}`} className="text-slate-300 hover:text-white text-xs transition-colors">Tümünü gör →</Link>
            </div>
            {!customer.invoices?.length ? (
              <div className="py-8 text-center text-slate-400 text-sm">{t('customerDetail', 'noSales')}</div>
            ) : (
              <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                    <th className="px-4 py-2 text-left">{t('customerDetail', 'date')}</th>
                    <th className="px-4 py-2 text-left">{t('customerDetail', 'invoiceNo')}</th>
                    <th className="px-4 py-2 text-right">{t('customerDetail', 'amount')}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.invoices.slice(0, invoicesShown).map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td className="px-4 py-2.5 text-slate-500">
                        <div>{new Date(inv.date).toLocaleDateString('tr-TR')}</div>
                        <div className="text-xs text-slate-400">{new Date(inv.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-blue-600">{inv.invoiceNo}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                        {inv.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{inv.currency}</span>
                      </td>
                      <td className="pr-3 text-slate-300">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customer.invoices.length > invoicesShown && (
                <div className="px-4 py-3 border-t text-center">
                  <button
                    onClick={() => setInvoicesShown(p => p + 10)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Daha Fazla Göster ({customer.invoices.length - invoicesShown} adet daha)
                  </button>
                </div>
              )}
              </>
            )}
          </div>

          {/* Previous Payments (merged with checks) */}
          {(() => {
            const DURUM_LABEL: Record<string, string> = {
              PORTFOY: 'Portföyde', BANKAYA_VERILDI: 'Bankaya Verildi',
              TEDARIKCI_VERILDI: 'Tedarikçiye Verildi', ODENDI: 'Tahsil Edildi',
              KARSILIKS: 'Karşılıksız', IPTAL: 'İptal',
            };
            const paymentRows = (customer.payments || []).map((p: any) => ({
              _type: 'payment', _date: new Date(p.date), ...p,
            }));
            const cekRows = cekler.map((c: any) => ({
              _type: 'cek', _date: new Date(c.islemTarihi), ...c,
            }));
            const merged = [...paymentRows, ...cekRows].sort((a, b) => b._date.getTime() - a._date.getTime());
            const shown = merged.slice(0, paymentsShown);

            const getPaymentRowBg = (row: any) => {
              if (row.method === 'Borç Fişi' || row.method === 'Alacak Fişi') return 'bg-slate-100/60';
              if (row.method === 'Bakiye Düzeltme') return 'bg-yellow-50/60';
              return '';
            };

            const getPaymentTipBadge = (row: any) => {
              if (row.method === 'Borç Fişi') return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">Borç Fişi</span>;
              if (row.method === 'Alacak Fişi') return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">Alacak Fişi</span>;
              if (row.method === 'Bakiye Düzeltme') return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Bakiye Düzeltme</span>;
              return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Tahsilat</span>;
            };

            return (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-700">
                  <h2 className="font-semibold text-white text-sm uppercase tracking-wide">{t('customerDetail', 'previousPayments')}</h2>
                </div>
                {!merged.length ? (
                  <div className="py-8 text-center text-slate-400 text-sm">{t('customerDetail', 'noPayments')}</div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                          <th className="px-4 py-2 text-left">{t('customerDetail', 'date')}</th>
                          <th className="px-4 py-2 text-left">Tip</th>
                          <th className="px-4 py-2 text-right">{t('customerDetail', 'amount')}</th>
                          <th className="px-4 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shown.map((row: any) => row._type === 'payment' ? (
                          <tr key={row.id} className={`group ${getPaymentRowBg(row)}`}>
                            <td className="px-4 py-2.5 text-slate-500">{row._date.toLocaleDateString('tr-TR')}</td>
                            <td className="px-4 py-2.5">{getPaymentTipBadge(row)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                              {row.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              <span className="text-xs font-normal text-slate-400 ml-1">{row.currency}</span>
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button onClick={() => handleDeletePayment(row.id, row.method)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.id} className="bg-cyan-50/40">
                            <td className="px-4 py-2.5 text-slate-500">{row._date.toLocaleDateString('tr-TR')}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">Çek</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-cyan-700">
                              {row.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              <span className="text-xs font-normal text-slate-400 ml-1">{row.currency}</span>
                            </td>
                            <td className="px-2 py-2.5"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {merged.length > paymentsShown && (
                      <div className="px-4 py-3 border-t text-center">
                        <button onClick={() => setPaymentsShown(p => p + 10)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          Daha Fazla Göster ({merged.length - paymentsShown} adet daha)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Return Invoices */}
        {customer.returns?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-red-700">
              <h2 className="font-semibold text-white text-sm uppercase tracking-wide">{t('customerDetail', 'returns')}</h2>
              <span className="text-red-200 text-xs">{customer.returns.length} iade</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                  <th className="px-4 py-2 text-left">{t('customerDetail', 'date')}</th>
                  <th className="px-4 py-2 text-left">{t('customerDetail', 'invoiceNo')}</th>
                  <th className="px-4 py-2 text-right">{t('customerDetail', 'amount')}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.returns.map((inv: any) => (
                  <tr key={inv.id} className="bg-red-50/50 hover:bg-red-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <td className="px-4 py-2.5 text-slate-500">
                      <div>{new Date(inv.date).toLocaleDateString('tr-TR')}</div>
                      <div className="text-xs text-slate-400">{new Date(inv.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-red-700">{inv.invoiceNo}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                      {inv.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-slate-400 ml-1">{inv.currency}</span>
                    </td>
                    <td className="pr-3 text-slate-300">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showIade && (
        <IadeModal customer={customer} onClose={() => setShowIade(false)} onSaved={load} />
      )}
      {showTahsilat && (
        <TahsilatModal
          customer={customer}
          onClose={() => setShowTahsilat(false)}
          onSaved={(amount) => {
            setShowTahsilat(false);
            setSuccessAmount(amount);
            load();
            setTimeout(() => setSuccessAmount(null), 4000);
          }}
        />
      )}
      {showCek && (
        <CekKayitModal
          customer={customer}
          onClose={() => setShowCek(false)}
          onSaved={() => { setShowCek(false); load(); }}
        />
      )}
      {showBorcFis && (
        <BorcAlacakFisModal
          customer={customer}
          onClose={() => setShowBorcFis(false)}
          onSaved={() => { setShowBorcFis(false); load(); }}
        />
      )}
      {showBakiyeDuzelt && (
        <BakiyeDuzeltModal
          customer={customer}
          currentBalance={customer.balance ?? 0}
          onClose={() => setShowBakiyeDuzelt(false)}
          onSaved={() => { setShowBakiyeDuzelt(false); load(); }}
        />
      )}
    </AppShell>
  );
}
