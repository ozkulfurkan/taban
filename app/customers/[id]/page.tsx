'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  ArrowLeft, Loader2, Pencil, FileText, ShoppingCart, Download, RotateCcw,
  Phone, Mail, MapPin, Hash, Save, X, User, ChevronRight, Building2, CheckCircle2, Banknote
} from 'lucide-react';
import Link from 'next/link';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Taslak', PENDING: 'Bekliyor', PARTIAL: 'Kısmi', PAID: 'Ödendi', CANCELLED: 'İptal',
};
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
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: '',
    paymentCurrency: customer.currency || 'TRY',
    amount: '',
    exchangeRate: '',
    method: 'Nakit',
    notes: '',
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : []));
  }, []);

  // Pre-fill exchange rate from company settings when currency changes
  useEffect(() => {
    if (form.paymentCurrency === customer.currency) { set('exchangeRate', ''); return; }
    // Try to get company exchange rates
    fetch('/api/company').then(r => r.json()).then(d => {
      if (form.paymentCurrency === 'USD' && d.usdToTry) set('exchangeRate', String(d.usdToTry));
      else if (form.paymentCurrency === 'EUR' && d.eurToTry) set('exchangeRate', String(d.eurToTry));
    }).catch(() => {});
  }, [form.paymentCurrency]);

  const isSameCurrency = form.paymentCurrency === (customer.currency || 'TRY');
  const amt = parseFloat(form.amount) || 0;
  const rate = parseFloat(form.exchangeRate) || 0;
  const recordedAmount = isSameCurrency ? amt : amt * rate;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || amt <= 0) return;
    if (!isSameCurrency && (!form.exchangeRate || rate <= 0)) return;
    setSaving(true);
    try {
      let notes = form.notes || null;
      if (!isSameCurrency) {
        const rateNote = `${amt} ${form.paymentCurrency} @ ${rate}`;
        notes = notes ? `${notes} | ${rateNote}` : rateNote;
      }
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          accountId: form.accountId || null,
          amount: recordedAmount,
          currency: customer.currency || 'TRY',
          originalAmount: isSameCurrency ? null : amt,
          originalCurrency: isSameCurrency ? null : form.paymentCurrency,
          exchangeRate: isSameCurrency ? null : rate,
          date: form.date,
          method: form.method,
          notes,
        }),
      });
      onSaved(recordedAmount);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="bg-emerald-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">Tahsilat Al</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800 font-medium truncate">
            {customer.name}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tarih</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kasa / Hesap</label>
            <select value={form.accountId} onChange={e => set('accountId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
              <option value="">Hesap seçin (isteğe bağlı)</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ödeme Dövizi</label>
              <select value={form.paymentCurrency} onChange={e => set('paymentCurrency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tutar *</label>
              <input required type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-right" />
            </div>
          </div>
          {!isSameCurrency && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">
                  1 {form.paymentCurrency} = __ {customer.currency || 'TRY'} (Kur)
                </label>
                <input required type="number" step="0.0001" min="0.0001" value={form.exchangeRate} onChange={e => set('exchangeRate', e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right bg-white" />
              </div>
              <div className="flex justify-between items-center border-t border-blue-200 pt-2">
                <span className="text-xs text-blue-700 font-medium">Kaydedilecek Tutar</span>
                <span className="text-base font-bold text-blue-800">
                  {recordedAmount > 0 ? recordedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'} {customer.currency || 'TRY'}
                </span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ödeme Şekli</label>
            <select value={form.method} onChange={e => set('method', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Not</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={saving || amt <= 0 || (!isSameCurrency && rate <= 0)}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IadeModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: 'Nakit', notes: 'İade' });
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
          date: form.date,
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
          <h3 className="text-white font-semibold">İade Al</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tutar *</label>
            <input required type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tarih</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Yöntem</label>
            <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white">
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Not</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showIade, setShowIade] = useState(false);
  const [showTahsilat, setShowTahsilat] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [invoicesShown, setInvoicesShown] = useState(10);
  const [paymentsShown, setPaymentsShown] = useState(10);

  const load = () => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/customers/${params.id}`)
      .then(r => r.json())
      .then(d => { setCustomer(d); setForm(d); })
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
                  <select value={form.currency ?? 'TRY'} onChange={e => setForm((p: any) => ({...p, currency: e.target.value}))}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white">
                    {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                  </select>
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
                  <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Kaydet
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-4 text-white bg-orange-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">Açık Bakiyesi</p>
            <p className="text-2xl font-bold">{(customer.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">Alacak</p>
          </div>
          <div className="rounded-xl p-4 text-white bg-blue-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">Toplam Fatura</p>
            <p className="text-2xl font-bold">{(customer.totalInvoiced || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">{(customer.invoices || []).length} fatura</p>
          </div>
          <div className="rounded-xl p-4 text-white bg-emerald-500 shadow-sm">
            <p className="text-xs font-medium opacity-80 mb-1">Tahsilat</p>
            <p className="text-2xl font-bold">{(customer.totalPaid || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs opacity-70 mt-0.5">{(customer.payments || []).length} ödeme</p>
          </div>
        </div>

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
              <p className="text-xs text-slate-400">
                Kalan bakiye: {Math.max(0, (customer.balance || 0) - successAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {customer.currency || 'TRY'}
              </p>
              <button onClick={() => setSuccessAmount(null)} className="mt-1 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                Tamam
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowTahsilat(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Banknote className="w-4 h-4" /> Tahsilat Al
          </button>
          <Link
            href={`/invoices/new?customerId=${customer.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" /> Satış Yap
          </Link>
          <Link
            href={`/quotes/new?customerId=${customer.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" /> Teklif Hazırla
          </Link>
          <button
            onClick={handleExtrePdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Hesap Ekstresi
          </button>
          <button
            onClick={() => setShowIade(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" /> İade Al
          </button>
        </div>

        {/* Previous Sales */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-700">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide">Önceki Satışlar</h2>
            <Link href="/invoices" className="text-slate-300 hover:text-white text-xs transition-colors">Tümünü gör →</Link>
          </div>
          {!customer.invoices?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm">Henüz satış yok</div>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                  <th className="px-4 py-2 text-left">Tarih</th>
                  <th className="px-4 py-2 text-left">No</th>
                  <th className="px-4 py-2 text-center">Durum</th>
                  <th className="px-4 py-2 text-right">Tutar</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.invoices.slice(0, invoicesShown).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-500">{new Date(inv.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{inv.invoiceNo}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                      {inv.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-slate-400 ml-1">{inv.currency}</span>
                    </td>
                    <td className="pr-3">
                      <Link href={`/invoices/${inv.id}`} className="p-1.5 text-slate-300 hover:text-blue-500 block transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
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

        {/* Previous Payments */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-700">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide">Önceki Ödemeler</h2>
          </div>
          {!customer.payments?.length ? (
            <div className="py-8 text-center text-slate-400 text-sm">Henüz ödeme yok</div>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 font-medium border-b bg-slate-50">
                  <th className="px-4 py-2 text-left">Tarih</th>
                  <th className="px-4 py-2 text-right">Tutar</th>
                  <th className="px-4 py-2 text-left">Şekli</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.payments.slice(0, paymentsShown).map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-500">{new Date(p.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
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
            {customer.payments.length > paymentsShown && (
              <div className="px-4 py-3 border-t text-center">
                <button
                  onClick={() => setPaymentsShown(p => p + 10)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Daha Fazla Göster ({customer.payments.length - paymentsShown} adet daha)
                </button>
              </div>
            )}
            </>
          )}
        </div>
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
    </AppShell>
  );
}
