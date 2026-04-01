'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { ArrowLeft, Loader2, Download, Plus, CheckCircle2, Building2 } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR');

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Taslak',   color: 'bg-slate-100 text-slate-600' },
  PENDING:   { label: 'Bekleyen', color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Kısmi',    color: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Ödendi',   color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'İptal',    color: 'bg-red-100 text-red-600' },
};

const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı'];

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '',
  });

  const load = () => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/purchases/${params.id}`)
      .then(r => r.json())
      .then(d => { if (!d?.error) setPurchase(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [params?.id]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return;
    setPayLoading(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          amount: payForm.amount,
          currency: purchase.currency,
          date: payForm.date,
          method: payForm.method,
          notes: payForm.notes,
        }),
      });
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '' });
      load();
    } catch (e) { console.error(e); }
    finally { setPayLoading(false); }
  };

  if (loading) return (
    <AppShell>
      <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
    </AppShell>
  );
  if (!purchase) return (
    <AppShell>
      <div className="text-center py-16 text-slate-400">Alış faturası bulunamadı</div>
    </AppShell>
  );

  const remaining = purchase.total - purchase.paidAmount;
  const st = STATUS_LABELS[purchase.status] ?? STATUS_LABELS.PENDING;

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">{purchase.invoiceNo || 'Alış Faturası'}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className="text-slate-500 text-sm">{purchase.supplier?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {purchase.status !== 'PAID' && purchase.status !== 'CANCELLED' && (
              <button onClick={() => setShowPayForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Ödeme Kaydet
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Toplam</p>
            <p className="text-lg font-bold text-slate-800">{fmt(purchase.total)}</p>
            <p className="text-xs text-slate-400">{purchase.currency}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Ödenen</p>
            <p className="text-lg font-bold text-teal-600">{fmt(purchase.paidAmount)}</p>
            <p className="text-xs text-slate-400">{purchase.currency}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Kalan</p>
            <p className={`text-lg font-bold ${remaining > 0 ? 'text-red-500' : 'text-teal-600'}`}>{fmt(remaining)}</p>
            <p className="text-xs text-slate-400">{purchase.currency}</p>
          </div>
        </div>

        {/* Payment Form */}
        {showPayForm && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <h3 className="font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Ödeme Kaydet
            </h3>
            <form onSubmit={handlePayment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Tutar *</label>
                <input required type="number" step="0.01" min="0.01"
                  value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Max: ${fmt(remaining)}`}
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Yöntem</label>
                <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 outline-none bg-white">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Tarih</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Not</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 outline-none" />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="button" onClick={() => setShowPayForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
                <button type="submit" disabled={payLoading}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Kaydet
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Purchase Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {/* Supplier info */}
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{purchase.supplier?.name}</p>
              {purchase.supplier?.taxId && <p className="text-xs text-slate-400">VKN: {purchase.supplier.taxId}</p>}
              {purchase.supplier?.phone && <p className="text-xs text-slate-400">{purchase.supplier.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tarih</p>
              <p className="font-medium text-slate-700">{fmtDate(purchase.date)}</p>
            </div>
            {purchase.invoiceNo && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Belge No</p>
                <p className="font-medium text-slate-700">{purchase.invoiceNo}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Para Birimi</p>
              <p className="font-medium text-slate-700">{purchase.currency}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Durum</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between font-bold text-slate-800 text-base">
              <span>Toplam</span>
              <span>{fmt(purchase.total)} {purchase.currency}</span>
            </div>
            {purchase.paidAmount > 0 && (
              <div className="flex justify-between text-teal-600">
                <span>Ödenen</span>
                <span>{fmt(purchase.paidAmount)} {purchase.currency}</span>
              </div>
            )}
            {remaining > 0 && (
              <div className="flex justify-between text-red-500 font-medium">
                <span>Kalan</span>
                <span>{fmt(remaining)} {purchase.currency}</span>
              </div>
            )}
          </div>

          {purchase.notes && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-400 mb-1">Notlar</p>
              <p className="text-sm text-slate-600">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Payment History */}
        {purchase.payments?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-slate-700 mb-4">Ödeme Geçmişi</h3>
            <div className="space-y-2">
              {purchase.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{fmtDate(p.date)} — {p.method}</p>
                    {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
                  </div>
                  <span className="font-semibold text-teal-600">
                    {fmt(p.amount)} {p.currency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
