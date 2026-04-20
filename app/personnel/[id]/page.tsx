'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import type { Employee } from '@/app/personnel/data';
import {
  ArrowLeft, Pencil, CreditCard, Banknote, TrendingUp, Scissors,
  CalendarDays, Clock, Upload, X, Loader2,
  CheckCircle2, AlertCircle, FileText, StickyNote, BarChart3,
  ChevronDown, Users, ClipboardList, Trash2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = 'Maaş' | 'Avans' | 'Prim' | 'Kesinti' | 'İzin' | 'Mesai' | 'Hakediş' | 'Diğer';

type LedgerEntry = {
  id: string;
  date: string;
  type: EntryType;
  description: string;
  debit: number;
  credit: number;
  account: string;
  createdBy: string;
};

type LeaveRecord = { id: string; startDate: string; endDate: string; type: string; days: number; note: string };
type OvertimeRecord = { id: string; date: string; hours: number; amount: number; note: string };
type DocumentRecord = { id: string; name: string; docType: string; size: number; mimeType: string; createdBy: string | null; createdAt: string };
type NoteRecord = { id: string; content: string; createdBy: string | null; createdAt: string };
type PerformRecord = { id: string; period: string; score: number; comment: string };


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

function formatMoney(n: number, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(n) + ' ' + currency;
}

const ENTRY_COLORS: Record<EntryType, string> = {
  Maaş: 'bg-blue-100 text-blue-700',
  Avans: 'bg-orange-100 text-orange-700',
  Prim: 'bg-green-100 text-green-700',
  Kesinti: 'bg-red-100 text-red-700',
  İzin: 'bg-purple-100 text-purple-700',
  Mesai: 'bg-indigo-100 text-indigo-700',
  Hakediş: 'bg-teal-100 text-teal-700',
  Diğer: 'bg-gray-100 text-gray-600',
};

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

// ─── Payment Modal (Maaş / Avans — kasa gerekli) ─────────────────────────────

type PaymentModalType = 'Maaş' | 'Avans';

function PaymentModal({ type, emp, empId, onClose, onSave }: {
  type: PaymentModalType;
  emp: Employee;
  empId: string;
  onClose: () => void;
  onSave: (entry: LedgerEntry) => void;
}) {
  const [amount, setAmount] = useState(type === 'Maaş' ? String(emp.salary) : '');
  const [accountId, setAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(data => {
      const all = Array.isArray(data) ? data : [];
      const list = all.filter((a: any) => a.currency === 'TRY');
      setAccounts(list);
      if (list.length > 0) { setAccountId(list[0].id); setAccountName(list[0].name); }
    }).catch(() => setAccounts([]));
  }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type,
          description: description || `${type} ödemesi`,
          amount: amt,
          account: accountName || null,
          accountId: accountId || null,
        }),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  const ICON_MAP: Record<PaymentModalType, React.ReactNode> = {
    Maaş: <CreditCard className="w-5 h-5 text-blue-600" />,
    Avans: <Banknote className="w-5 h-5 text-orange-600" />,
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {ICON_MAP[type]}
            <h2 className="text-base font-semibold text-gray-900">{type} Öde</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tutar ({emp.currency}) *</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kasa / Banka *</label>
            <select className={inputCls} value={accountId} onChange={e => {
              setAccountId(e.target.value);
              setAccountName(accounts.find(a => a.id === e.target.value)?.name || '');
            }}>
              {accounts.length === 0 && <option value="">Kasa yükleniyor...</option>}
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <textarea rows={2} className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder={`${type} açıklaması...`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Öde
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Hakediş Modal (personeli alacaklandır, kasa yok) ─────────────────────────

function HakedisModal({ emp, empId, onClose, onSave }: {
  emp: Employee;
  empId: string;
  onClose: () => void;
  onSave: (entry: LedgerEntry) => void;
}) {
  const [amount, setAmount] = useState(String(emp.salary));
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type: 'Hakediş',
          description: description || 'Hakediş',
          amount: amt,
        }),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900">Hakediş Ekle</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <p className="text-xs text-gray-500 bg-teal-50 px-3 py-2 rounded-lg">Personeli alacaklandırır. Kasadan para çıkmaz.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tutar ({emp.currency}) *</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Nisan 2026 hakedişi..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Prim Modal (alacak, kasa yok) ────────────────────────────────────────────

function PrimModal({ emp, empId, onClose, onSave }: {
  emp: Employee;
  empId: string;
  onClose: () => void;
  onSave: (entry: LedgerEntry) => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type: 'Prim',
          description: description || 'Prim',
          amount: amt,
        }),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-900">Prim Ekle</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <p className="text-xs text-gray-500 bg-green-50 px-3 py-2 rounded-lg">Personeli alacaklandırır. Kasadan para çıkmaz.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prim Tutarı ({emp.currency}) *</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Performans primi..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Kesinti Modal (borç, kasa yok) ───────────────────────────────────────────

function KesModal({ emp, empId, onClose, onSave }: {
  emp: Employee;
  empId: string;
  onClose: () => void;
  onSave: (entry: LedgerEntry) => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type: 'Kesinti',
          description: description || 'Kesinti',
          amount: amt,
        }),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-semibold text-gray-900">Kesinti Yap</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <p className="text-xs text-gray-500 bg-red-50 px-3 py-2 rounded-lg">Personeli borçlandırır. Kasadan para çıkmaz.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kesinti Tutarı ({emp.currency}) *</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Kesinti nedeni..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────

function LeaveModal({ empId, onClose, onSave }: { empId: string; onClose: () => void; onSave: (r: LeaveRecord) => void }) {
  const [form, setForm] = useState({ type: 'Yıllık', startDate: '', endDate: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const days = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const d = (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000 + 1;
    return Math.max(0, d);
  }, [form.startDate, form.endDate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate || days <= 0) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, days }),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold">İzin Gir</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">İzin Türü</label>
            <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
              {['Yıllık', 'Mazeret', 'Ücretsiz', 'Hastalık'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Başlangıç</label>
              <input type="date" className={inputCls} value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bitiş</label>
              <input type="date" className={inputCls} value={form.endDate} onChange={e => set('endDate', e.target.value)} required />
            </div>
          </div>
          {days > 0 && <p className="text-xs text-blue-600 font-medium">{days} iş günü</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input className={inputCls} value={form.note} onChange={e => set('note', e.target.value)} placeholder="İzin nedeni..." />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Overtime Modal ───────────────────────────────────────────────────────────

function OvertimeModal({ empId, onClose, onSave }: { empId: string; onClose: () => void; onSave: (r: OvertimeRecord) => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: '', amount: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}/overtimes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: form.date, hours: form.hours, amount: form.amount, note: form.note }),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-600" /><h2 className="text-base font-semibold">Mesai Ekle</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
            <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Saat</label>
              <input type="number" min="0.5" step="0.5" className={inputCls} value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="4" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tutar (TRY)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="800" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input className={inputCls} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Mesai nedeni..." />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Document Modal ───────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function DocumentModal({ empId, onClose, onSave }: { empId: string; onClose: () => void; onSave: (r: DocumentRecord) => void }) {
  const [docType, setDocType] = useState('Sözleşme');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_SIZE) {
      setErr('Dosya 5 MB sınırını aşıyor.');
      setFile(null);
      e.target.value = '';
      return;
    }
    setErr('');
    setFile(f);
  };

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setErr('Lütfen bir dosya seçin.'); return; }
    setSaving(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      const res = await fetch(`/api/personnel/${empId}/documents`, { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Yükleme başarısız');
      }
      const doc = await res.json();
      onSave(doc);
    } catch (ex: any) {
      setErr(ex.message || 'Yükleme sırasında hata oluştu.');
      setSaving(false);
    }
  };

  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-gray-600" /><h2 className="text-base font-semibold">Evrak Yükle</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dosya * (max 5 MB)</label>
            <input
              type="file"
              onChange={handleFile}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
            />
            {file && <p className="text-xs text-gray-400 mt-1">{file.name} · {formatSize(file.size)}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Belge Türü</label>
            <select className={inputCls} value={docType} onChange={e => setDocType(e.target.value)}>
              {['Sözleşme', 'Kimlik', 'SGK', 'Diploma', 'Sertifika', 'Diğer'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Yükle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ emp, empId, onClose, onSave, onLeave }: {
  emp: Employee;
  empId: string;
  onClose: () => void;
  onSave: (updated: Partial<Employee>) => void;
  onLeave: () => void;
}) {
  const [form, setForm] = useState({
    name: emp.name, department: emp.department, role: emp.role,
    salary: String(emp.salary), payday: String(emp.payday), status: emp.status,
  });
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/personnel/${empId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, department: form.department, role: form.role, salary: form.salary, payday: form.payday, status: form.status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSave(updated);
    } catch {
      setErr('Güncelleme sırasında hata oluştu.');
      setSaving(false);
    }
  };

  const handleLeave = async () => {
    try {
      const res = await fetch(`/api/personnel/${empId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'left' }),
      });
      if (!res.ok) throw new Error();
      onLeave();
    } catch {
      setErr('İşlem sırasında hata oluştu.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Pencil className="w-5 h-5 text-gray-600" /><h2 className="text-base font-semibold">Personel Düzenle</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Departman</label>
              <input className={inputCls} value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Görev</label>
              <input className={inputCls} value={form.role} onChange={e => set('role', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Maaş</label>
              <input type="number" min="0" className={inputCls} value={form.salary} onChange={e => set('salary', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Maaş Günü</label>
              <input type="number" min="1" max="31" className={inputCls} value={form.payday} onChange={e => set('payday', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Durum</label>
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Aktif</option>
              <option value="left">Ayrıldı</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
          <div className="pt-2 border-t border-gray-100">
            {confirmLeave ? (
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-sm text-red-700 mb-3">Personeli işten çıkarmak istediğinizden emin misiniz?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmLeave(false)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Hayır</button>
                  <button type="button" onClick={handleLeave} className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Evet, Çıkar</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmLeave(true)} className="w-full px-4 py-2 text-red-600 text-sm hover:bg-red-50 rounded-lg transition-colors">
                Personeli İşten Çıkar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ledger Edit Modal ────────────────────────────────────────────────────────

function LedgerEditModal({ entry, empId, onClose, onSaved }: {
  entry: LedgerEntry & { paymentId?: string };
  empId: string;
  onClose: () => void;
  onSaved: (updated: any) => void;
}) {
  const hasCash = (entry.type === 'Maaş' || entry.type === 'Avans');
  const [amount, setAmount] = useState(String(hasCash ? Number(entry.debit) : Number(entry.credit)));
  const [description, setDescription] = useState(entry.description || '');
  const [date, setDate] = useState(entry.date ? entry.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [accountName, setAccountName] = useState(entry.account || '');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!hasCash) return;
    fetch('/api/accounts').then(r => r.json()).then(data => {
      const list = (Array.isArray(data) ? data : []).filter((a: any) => a.currency === 'TRY');
      setAccounts(list);
      const match = list.find((a: any) => a.name === entry.account);
      if (match) setAccountId(match.id);
      else if (list.length > 0) setAccountId(list[0].id);
    }).catch(() => {});
  }, [hasCash, entry.account]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    setErr('');
    try {
      // Delete old entry (reverses kasa if needed)
      const delRes = await fetch(`/api/personnel/${empId}/ledger?entryId=${entry.id}`, { method: 'DELETE' });
      if (!delRes.ok) throw new Error();
      // Create new entry
      const selAcc = accounts.find(a => a.id === accountId);
      const res = await fetch(`/api/personnel/${empId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type: entry.type,
          description,
          amount: amt,
          account: selAcc?.name || accountName || null,
          accountId: hasCash ? (accountId || null) : null,
        }),
      });
      if (!res.ok) throw new Error();
      onSaved({ deleted: entry.id, created: await res.json() });
    } catch {
      setErr('Güncelleme sırasında hata oluştu.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-semibold text-gray-900">{entry.type} Düzenle</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tutar *</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          {hasCash && accounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kasa *</label>
              <select className={inputCls} value={accountId} onChange={e => {
                setAccountId(e.target.value);
                setAccountName(accounts.find(a => a.id === e.target.value)?.name || '');
              }}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

type ModalType = 'Maaş' | 'Avans' | 'Prim' | 'Kesinti' | 'Hakediş' | 'İzin' | 'Mesai' | 'Evrak' | 'Düzenle' | null;
type TabType = 'izinler' | 'mesailer' | 'belgeler' | 'notlar' | 'performans';

export default function PersonnelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [emp, setEmp] = useState<Employee | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [perfs] = useState<PerformRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [tab, setTab] = useState<TabType>('izinler');
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingEntry, setEditingEntry] = useState<(LedgerEntry & { paymentId?: string }) | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/personnel/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/personnel/${id}/documents`).then(r => r.ok ? r.json() : []),
      fetch(`/api/personnel/${id}/leaves`).then(r => r.ok ? r.json() : []),
      fetch(`/api/personnel/${id}/overtimes`).then(r => r.ok ? r.json() : []),
      fetch(`/api/personnel/${id}/notes`).then(r => r.ok ? r.json() : []),
    ]).then(([empData, docsData, leavesData, overtimesData, notesData]) => {
      if (empData) {
        const { ledger: ledgerData, ...emp } = empData;
        setEmp(emp);
        setLedger((ledgerData || []).sort((a: LedgerEntry, b: LedgerEntry) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
      setDocs(Array.isArray(docsData) ? docsData : []);
      setLeaves(Array.isArray(leavesData) ? leavesData : []);
      setOvertimes(Array.isArray(overtimesData) ? overtimesData : []);
      setNotes(Array.isArray(notesData) ? notesData : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/personnel/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteInput }),
      });
      if (!res.ok) throw new Error();
      const note = await res.json();
      setNotes(p => [note, ...p]);
      setNoteInput('');
    } catch {
      showToast('Not kaydedilemedi.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteEntry = async (entry: LedgerEntry & { paymentId?: string }) => {
    if (!confirm(`"${entry.type}" kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/personnel/${id}/ledger?entryId=${entry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setLedger(prev => prev.filter(e => e.id !== entry.id));
      showToast('Kayıt silindi.');
    } catch {
      showToast('Silme sırasında hata oluştu.', 'error');
    }
  };

  // Kümülatif bakiye hesapla (en eski → en yeni)
  const ledgerWithBalance = useMemo(() => {
    let running = 0;
    return [...ledger].reverse().map(e => {
      running += (Number(e.credit) || 0) - (Number(e.debit) || 0);
      return { ...e, runningBalance: running };
    }).reverse();
  }, [ledger]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!emp) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <Users className="w-10 h-10 mx-auto mb-3" />
            <p>Personel bulunamadı</p>
            <button onClick={() => router.push('/personnel')} className="mt-3 text-blue-600 text-sm hover:underline">← Listeye Dön</button>
          </div>
        </div>
      </AppShell>
    );
  }

  const ACTION_BUTTONS = [
    { label: 'Hakediş Ekle', icon: ClipboardList, color: 'bg-teal-600 hover:bg-teal-700 text-white', modal: 'Hakediş' as ModalType },
    { label: 'Maaş Öde', icon: CreditCard, color: 'bg-blue-600 hover:bg-blue-700 text-white', modal: 'Maaş' as ModalType },
    { label: 'Avans Ver', icon: Banknote, color: 'bg-orange-500 hover:bg-orange-600 text-white', modal: 'Avans' as ModalType },
    { label: 'Prim Ekle', icon: TrendingUp, color: 'bg-green-600 hover:bg-green-700 text-white', modal: 'Prim' as ModalType },
    { label: 'Kesinti Yap', icon: Scissors, color: 'bg-red-500 hover:bg-red-600 text-white', modal: 'Kesinti' as ModalType },
    { label: 'İzin Gir', icon: CalendarDays, color: 'bg-purple-600 hover:bg-purple-700 text-white', modal: 'İzin' as ModalType },
    { label: 'Mesai Ekle', icon: Clock, color: 'bg-indigo-600 hover:bg-indigo-700 text-white', modal: 'Mesai' as ModalType },
    { label: 'Evrak Yükle', icon: Upload, color: 'bg-gray-600 hover:bg-gray-700 text-white', modal: 'Evrak' as ModalType },
    { label: 'Düzenle', icon: Pencil, color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200', modal: 'Düzenle' as ModalType },
  ];

  const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: 'izinler', label: 'İzinler', icon: CalendarDays },
    { key: 'mesailer', label: 'Mesailer', icon: Clock },
    { key: 'belgeler', label: 'Belgeler', icon: FileText },
    { key: 'notlar', label: 'Notlar', icon: StickyNote },
    { key: 'performans', label: 'Performans', icon: BarChart3 },
  ];

  // Compute balance from ledger (source of truth)
  const balance = ledger.reduce((sum, e) => sum + (Number(e.credit) || 0) - (Number(e.debit) || 0), 0);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">

        {/* Back */}
        <button onClick={() => router.push('/personnel')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Personel Listesi
        </button>

        {/* Info Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-blue-600">{emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{emp.name}</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {emp.status === 'active' ? 'Aktif' : 'Ayrıldı'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{emp.role} · {emp.department}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100">
            {[
              { label: 'İşe Giriş', value: formatDate(emp.hireDate) },
              { label: 'Maaş', value: formatMoney(emp.salary, emp.currency) },
              { label: 'Kalan İzin', value: emp.leaveBalance + ' gün' },
              { label: 'Bakiye', value: balance === 0 ? '—' : (balance > 0 ? '+' : '') + formatMoney(balance, emp.currency), color: balance < 0 ? 'text-red-600' : balance > 0 ? 'text-green-600' : 'text-gray-700' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className={`text-sm font-semibold ${item.color ?? 'text-gray-800'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons — Desktop */}
        <div className="hidden sm:flex flex-wrap gap-2 mb-4">
          {ACTION_BUTTONS.map(btn => (
            <button key={btn.label} onClick={() => setModal(btn.modal)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm ${btn.color}`}>
              <btn.icon className="w-4 h-4" />
              {btn.label}
            </button>
          ))}
        </div>

        {/* Action Buttons — Mobile Dropdown */}
        <div className="sm:hidden mb-4">
          <button onClick={() => setMobileActionsOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 shadow-sm">
            İşlemler
            <ChevronDown className={`w-4 h-4 transition-transform ${mobileActionsOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileActionsOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ACTION_BUTTONS.map(btn => (
                <button key={btn.label} onClick={() => { setModal(btn.modal); setMobileActionsOpen(false); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${btn.color}`}>
                  <btn.icon className="w-4 h-4" />
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content: Ledger + Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Left: Ledger */}
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Ekstre</h2>
            </div>
            {ledgerWithBalance.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Hareket yok</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tarih</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tür</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Açıklama</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-red-500">Borç</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-green-600">Alacak</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Bakiye</th>
                      <th className="px-2 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ledgerWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ENTRY_COLORS[e.type as EntryType] ?? 'bg-gray-100 text-gray-600'}`}>{e.type}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-[160px] truncate">{e.description}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{Number(e.debit) > 0 ? formatMoney(Number(e.debit)) : '—'}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{Number(e.credit) > 0 ? formatMoney(Number(e.credit)) : '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${e.runningBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatMoney(e.runningBalance)}
                        </td>
                        <td className="px-2 py-3 w-16">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => handleDeleteEntry(e as any)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors" title="Sil">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingEntry(e as any)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Düzenle">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Tabs */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto max-h-[500px]">

              {tab === 'izinler' && (
                <div className="space-y-2">
                  {leaves.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">İzin kaydı yok</p> :
                    leaves.map((l: any) => (
                      <div key={l.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{l.type}</span>
                          <p className="text-sm text-gray-700 mt-1">{formatDate(l.startDate)} – {formatDate(l.endDate)}</p>
                          {l.note && <p className="text-xs text-gray-400 mt-0.5">{l.note}</p>}
                        </div>
                        <span className="text-sm font-bold text-gray-700 ml-3">{l.days}g</span>
                      </div>
                    ))}
                </div>
              )}

              {tab === 'mesailer' && (
                <div className="space-y-2">
                  {overtimes.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Mesai kaydı yok</p> :
                    overtimes.map((o: any) => (
                      <div key={o.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{formatDate(o.date)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{o.note}</p>
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-sm font-bold text-indigo-600">{o.hours} saat</p>
                          {o.amount > 0 && <p className="text-xs text-gray-500">{formatMoney(o.amount)}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {tab === 'belgeler' && (
                <div className="space-y-2">
                  {docs.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Belge yok</p> :
                    docs.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 font-medium truncate">{d.name}</p>
                            <p className="text-xs text-gray-400">{d.docType} · {formatDate(d.createdAt)} · {d.size < 1048576 ? (d.size / 1024).toFixed(0) + ' KB' : (d.size / 1048576).toFixed(1) + ' MB'}</p>
                          </div>
                        </div>
                        <a
                          href={`/api/personnel/${id}/documents/${d.id}`}
                          download={d.name}
                          className="text-xs text-blue-600 hover:underline ml-2 flex-shrink-0"
                        >
                          İndir
                        </a>
                      </div>
                    ))}
                </div>
              )}

              {tab === 'notlar' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      placeholder="Yeni not ekle..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote || !noteInput.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                      {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                    </button>
                  </div>
                  {notes.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Not yok</p> :
                    notes.map(n => (
                      <div key={n.id} className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-sm text-gray-700">{n.content}</p>
                        <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.createdAt)} · {n.createdBy || 'Sistem'}</p>
                      </div>
                    ))}
                </div>
              )}

              {tab === 'performans' && (
                <div className="space-y-3">
                  {perfs.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Değerlendirme yok</p> :
                    perfs.map(p => (
                      <div key={p.id} className="p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">{p.period}</span>
                          <span className={`text-sm font-bold ${p.score >= 90 ? 'text-green-600' : p.score >= 75 ? 'text-blue-600' : 'text-orange-500'}`}>{p.score}/100</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                          <div className={`h-1.5 rounded-full ${p.score >= 90 ? 'bg-green-500' : p.score >= 75 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: p.score + '%' }} />
                        </div>
                        <p className="text-xs text-gray-400">{p.comment}</p>
                      </div>
                    ))}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'Maaş' || modal === 'Avans') && (
        <PaymentModal
          type={modal as PaymentModalType}
          emp={emp}
          empId={id}
          onClose={() => setModal(null)}
          onSave={entry => {
            setLedger(p => [entry, ...p]);
            setModal(null);
            showToast(`${modal} kaydedildi — kasa güncellendi.`);
          }}
        />
      )}
      {modal === 'Hakediş' && (
        <HakedisModal
          emp={emp}
          empId={id}
          onClose={() => setModal(null)}
          onSave={entry => {
            setLedger(p => [entry, ...p]);
            setModal(null);
            showToast('Hakediş kaydedildi.');
          }}
        />
      )}
      {modal === 'Prim' && (
        <PrimModal
          emp={emp}
          empId={id}
          onClose={() => setModal(null)}
          onSave={entry => {
            setLedger(p => [entry, ...p]);
            setModal(null);
            showToast('Prim kaydedildi.');
          }}
        />
      )}
      {modal === 'Kesinti' && (
        <KesModal
          emp={emp}
          empId={id}
          onClose={() => setModal(null)}
          onSave={entry => {
            setLedger(p => [entry, ...p]);
            setModal(null);
            showToast('Kesinti kaydedildi.');
          }}
        />
      )}
      {modal === 'İzin' && (
        <LeaveModal
          empId={id}
          onClose={() => setModal(null)}
          onSave={record => {
            setLeaves(p => [record, ...p]);
            setEmp(e => e ? { ...e, leaveBalance: Math.max(0, e.leaveBalance - record.days) } : e);
            setModal(null);
            setTab('izinler');
            showToast('İzin kaydedildi.');
          }}
        />
      )}
      {modal === 'Mesai' && (
        <OvertimeModal
          empId={id}
          onClose={() => setModal(null)}
          onSave={record => {
            setOvertimes(p => [record, ...p]);
            setModal(null);
            setTab('mesailer');
            showToast('Mesai kaydedildi.');
          }}
        />
      )}
      {modal === 'Evrak' && (
        <DocumentModal
          empId={id}
          onClose={() => setModal(null)}
          onSave={record => {
            setDocs(p => [record, ...p]);
            setModal(null);
            setTab('belgeler');
            showToast('Belge yüklendi.');
          }}
        />
      )}
      {modal === 'Düzenle' && (
        <EditModal
          emp={emp}
          empId={id}
          onClose={() => setModal(null)}
          onSave={updated => {
            setEmp(e => e ? { ...e, ...updated } : e);
            setModal(null);
            showToast('Personel bilgileri güncellendi.');
          }}
          onLeave={() => {
            setEmp(e => e ? { ...e, status: 'left' } : e);
            setModal(null);
            showToast('Personel işten çıkarıldı.', 'error');
          }}
        />
      )}

      {editingEntry && (
        <LedgerEditModal
          entry={editingEntry}
          empId={id}
          onClose={() => setEditingEntry(null)}
          onSaved={({ deleted, created }) => {
            setLedger(prev => [created, ...prev.filter(e => e.id !== deleted)]);
            setEditingEntry(null);
            showToast('Kayıt güncellendi.');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </AppShell>
  );
}
