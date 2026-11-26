'use client';

// Tahsilat / ödeme düzenle: tutar, tarih, kasa, açıklama; döviz kaydında kasa tutarı ve kur.
// Sunucu eski kaydı kasadan ve faturadan geri alıp yenisini uygular (PUT /api/payments/[id]).
import { useEffect, useState } from 'react';
import { Loader2, Save, X } from '@/app/components/icons';
import { toDateInputValue } from '@/lib/time';

export type EditablePayment = {
  id: string; amount: number; currency: string; method?: string | null; notes?: string | null; date: string | Date;
  accountId?: string | null; originalAmount?: number | null; originalCurrency?: string | null; exchangeRate?: number | null;
};

const num = (s: string) => { const t = String(s).trim(); return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
const str = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

export default function PaymentEditModal({ payment, onClose, onSaved }: { payment: EditablePayment; onClose: () => void; onSaved: () => void }) {
  // Çek (portföy bağı) ve transfer (iki kayıt): yalnız tarih ve açıklama
  const isCek = payment.method === 'Çek' || payment.method === 'Transfer';
  const foreign = payment.originalAmount != null;
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; currency: string }>>([]);
  const [form, setForm] = useState({
    amount: str(payment.amount), originalAmount: str(payment.originalAmount), exchangeRate: str(payment.exchangeRate),
    accountId: payment.accountId ?? '', date: toDateInputValue(new Date(payment.date)), notes: payment.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : [])).catch(() => {}); }, []);
  const set = (k: keyof typeof form, v: string) => setForm(f => {
    const n = { ...f, [k]: v };
    // Döviz kaydı: kasa tutarı veya kur değişince kayıt tutarı yeniden hesaplanır (kayıt = kasa tutarı / kur)
    if (foreign && (k === 'originalAmount' || k === 'exchangeRate')) {
      const o = num(n.originalAmount); const r = num(n.exchangeRate);
      if (o > 0 && r > 0) n.amount = str(Math.round((o / r) * 100) / 100);
    }
    return n;
  });

  const save = async () => {
    setBusy(true); setError('');
    const body: any = { date: form.date, notes: form.notes };
    if (!isCek) {
      body.amount = num(form.amount);
      // Kasa bilgisi gelmeyen listelerde kasa bağı korunur
      if (payment.accountId !== undefined) body.accountId = form.accountId || null;
      if (foreign) { body.originalAmount = num(form.originalAmount); body.exchangeRate = num(form.exchangeRate); }
    }
    const r = await fetch(`/api/payments/${payment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); return; }
    setError(j.error || 'Kaydedilemedi');
  };

  const input = 'w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none disabled:bg-ink-50 disabled:text-ink-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-ink-200/80" role="dialog" aria-label="Kaydı düzenle">
        <div className="bg-brand-700 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">Kaydı düzenle</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); void save(); }} className="p-5 space-y-3">
          {isCek && <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">{payment.method === 'Transfer' ? 'Hesaplar arası transferde' : 'Çek ile yapılan kayıtta'} yalnız tarih ve açıklama değiştirilebilir. Tutarı değiştirmek için kaydı silip yeniden girin.</p>}
          {!isCek && <div>
            <label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="pe-account">Kasa / banka</label>
            <select id="pe-account" value={form.accountId} onChange={e => set('accountId', e.target.value)} className={`${input} bg-white`}>
              <option value="">Kasa yok</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </div>}
          {foreign && !isCek && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="pe-orig">Kasa tutarı ({payment.originalCurrency})</label>
                <input id="pe-orig" value={form.originalAmount} onChange={e => set('originalAmount', e.target.value)} inputMode="decimal" className={`${input} text-right`} /></div>
              <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="pe-rate">Kur (1 {payment.currency})</label>
                <input id="pe-rate" value={form.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} inputMode="decimal" className={`${input} text-right`} /></div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="pe-amount">Tutar ({payment.currency})</label>
            <input id="pe-amount" value={form.amount} onChange={e => set('amount', e.target.value)} inputMode="decimal" disabled={isCek || foreign}
              className={`${input} text-right font-semibold`} data-testid="pe-amount" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="pe-date">Tarih</label>
            <input id="pe-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1" htmlFor="pe-notes">Açıklama</label>
            <input id="pe-notes" value={form.notes} onChange={e => set('notes', e.target.value)} className={input} />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">Vazgeç</button>
            <button type="submit" disabled={busy} data-testid="pe-save"
              className="flex-1 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
