'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { MOCK_EMPLOYEES } from '@/app/personnel/page';
import type { Employee } from '@/app/personnel/page';
import {
  ArrowLeft, Pencil, CreditCard, Banknote, TrendingUp, Scissors,
  CalendarDays, Clock, Upload, ChevronRight, X, Loader2,
  CheckCircle2, AlertCircle, FileText, StickyNote, BarChart3,
  ChevronDown, Users
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = 'Maaş' | 'Avans' | 'Prim' | 'Kesinti' | 'İzin' | 'Mesai' | 'Diğer';

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
type DocumentRecord = { id: string; name: string; docType: string; date: string };
type NoteRecord = { id: string; date: string; content: string; createdBy: string };
type PerformRecord = { id: string; period: string; score: number; comment: string };

// ─── Mock Ledger ─────────────────────────────────────────────────────────────

const MOCK_LEDGER: LedgerEntry[] = [
  { id: 'l1', date: '2026-04-05', type: 'Maaş', description: 'Nisan 2026 maaş ödemesi', debit: 0, credit: 25000, account: 'Ana Kasa', createdBy: 'Admin' },
  { id: 'l2', date: '2026-03-25', type: 'Avans', description: 'Mart avans talebi', debit: 3000, credit: 0, account: 'Ana Kasa', createdBy: 'Admin' },
  { id: 'l3', date: '2026-03-05', type: 'Maaş', description: 'Mart 2026 maaş ödemesi', debit: 0, credit: 25000, account: 'Ana Kasa', createdBy: 'Admin' },
  { id: 'l4', date: '2026-02-15', type: 'Prim', description: 'Yılsonu performans primi', debit: 0, credit: 5000, account: 'Banka', createdBy: 'Muhasebe' },
  { id: 'l5', date: '2026-02-05', type: 'Maaş', description: 'Şubat 2026 maaş ödemesi', debit: 0, credit: 25000, account: 'Ana Kasa', createdBy: 'Admin' },
  { id: 'l6', date: '2026-01-20', type: 'Kesinti', description: 'Gecikme kesintisi', debit: 500, credit: 0, account: '—', createdBy: 'İK' },
  { id: 'l7', date: '2026-01-05', type: 'Maaş', description: 'Ocak 2026 maaş ödemesi', debit: 0, credit: 25000, account: 'Ana Kasa', createdBy: 'Admin' },
];

const MOCK_LEAVES: LeaveRecord[] = [
  { id: 'lv1', startDate: '2026-03-10', endDate: '2026-03-14', type: 'Yıllık', days: 5, note: 'Tatil' },
  { id: 'lv2', startDate: '2025-12-24', endDate: '2025-12-25', type: 'Mazeret', days: 2, note: 'Kişisel' },
  { id: 'lv3', startDate: '2025-08-01', endDate: '2025-08-15', type: 'Yıllık', days: 15, note: 'Yaz tatili' },
];

const MOCK_OVERTIMES: OvertimeRecord[] = [
  { id: 'ot1', date: '2026-04-12', hours: 4, amount: 800, note: 'Hafta sonu üretim' },
  { id: 'ot2', date: '2026-03-28', hours: 6, amount: 1200, note: 'Acil sipariş' },
  { id: 'ot3', date: '2026-02-20', hours: 3, amount: 600, note: 'Bakım çalışması' },
];

const MOCK_DOCS: DocumentRecord[] = [
  { id: 'd1', name: 'İş Sözleşmesi.pdf', docType: 'Sözleşme', date: '2021-03-15' },
  { id: 'd2', name: 'Kimlik Fotokopisi.pdf', docType: 'Kimlik', date: '2021-03-15' },
  { id: 'd3', name: 'SGK Belgesi.pdf', docType: 'SGK', date: '2022-01-10' },
];

const MOCK_NOTES: NoteRecord[] = [
  { id: 'n1', date: '2026-03-15', content: 'Performans değerlendirmesi olumlu. Terfi önerisi yapıldı.', createdBy: 'İK Yöneticisi' },
  { id: 'n2', date: '2025-11-20', content: 'Eğitime katıldı, sertifika alındı.', createdBy: 'Admin' },
];

const MOCK_PERF: PerformRecord[] = [
  { id: 'p1', period: 'Q1 2026', score: 88, comment: 'Hedefleri %90 gerçekleştirdi' },
  { id: 'p2', period: 'Q4 2025', score: 92, comment: 'Mükemmel performans' },
  { id: 'p3', period: 'Q3 2025', score: 78, comment: 'Gelişim alanları belirlendi' },
];

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
  Diğer: 'bg-gray-100 text-gray-600',
};

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

// ─── Payment Modal ────────────────────────────────────────────────────────────

type PaymentModalType = 'Maaş' | 'Avans' | 'Prim' | 'Kesinti';

function PaymentModal({ type, emp, onClose, onSave }: {
  type: PaymentModalType;
  emp: Employee;
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

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : [];
      setAccounts(list);
      if (list.length > 0) { setAccountId(list[0].id); setAccountName(list[0].name); }
    }).catch(() => setAccounts([]));
  }, []);

  const isDebit = type === 'Kesinti';

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const entry: LedgerEntry = {
      id: 'l-' + Date.now(),
      date,
      type,
      description: description || `${type} ödemesi`,
      debit: isDebit ? amt : 0,
      credit: isDebit ? 0 : amt,
      account: accountName || '—',
      createdBy: 'Kullanıcı',
    };
    onSave(entry);
    setSaving(false);
  };

  const ICON_MAP: Record<PaymentModalType, React.ReactNode> = {
    Maaş: <CreditCard className="w-5 h-5 text-blue-600" />,
    Avans: <Banknote className="w-5 h-5 text-orange-600" />,
    Prim: <TrendingUp className="w-5 h-5 text-green-600" />,
    Kesinti: <Scissors className="w-5 h-5 text-red-600" />,
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {ICON_MAP[type]}
            <h2 className="text-base font-semibold text-gray-900">{type} {isDebit ? 'Yap' : 'Öde'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tutar ({emp.currency}) *</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kasa / Banka</label>
            <select className={inputCls} value={accountId} onChange={e => {
              setAccountId(e.target.value);
              const acc = accounts.find(a => a.id === e.target.value);
              setAccountName(acc?.name || '');
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
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────

function LeaveModal({ onClose, onSave }: { onClose: () => void; onSave: (r: LeaveRecord) => void }) {
  const [form, setForm] = useState({ type: 'Yıllık', startDate: '', endDate: '', note: '' });
  const [saving, setSaving] = useState(false);
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
    await new Promise(r => setTimeout(r, 300));
    onSave({ id: 'lv-' + Date.now(), ...form, days });
    setSaving(false);
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

function OvertimeModal({ onClose, onSave }: { onClose: () => void; onSave: (r: OvertimeRecord) => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: '', amount: '', note: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    onSave({ id: 'ot-' + Date.now(), date: form.date, hours: parseFloat(form.hours) || 0, amount: parseFloat(form.amount) || 0, note: form.note });
    setSaving(false);
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

function DocumentModal({ onClose, onSave }: { onClose: () => void; onSave: (r: DocumentRecord) => void }) {
  const [form, setForm] = useState({ name: '', docType: 'Sözleşme' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    onSave({ id: 'd-' + Date.now(), ...form, date: new Date().toISOString().slice(0, 10) });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-gray-600" /><h2 className="text-base font-semibold">Evrak Yükle</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dosya Adı *</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Belge_Adi.pdf" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Belge Türü</label>
            <select className={inputCls} value={form.docType} onChange={e => set('docType', e.target.value)}>
              {['Sözleşme', 'Kimlik', 'SGK', 'Diploma', 'Sertifika', 'Diğer'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">İptal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ emp, onClose, onSave, onLeave }: {
  emp: Employee;
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
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    onSave({ name: form.name, department: form.department, role: form.role, salary: parseFloat(form.salary) || emp.salary, payday: parseInt(form.payday) || emp.payday, status: form.status as any });
    setSaving(false);
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
                  <button type="button" onClick={onLeave} className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Evet, Çıkar</button>
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

// ─── Main Detail Page ─────────────────────────────────────────────────────────

type ModalType = 'Maaş' | 'Avans' | 'Prim' | 'Kesinti' | 'İzin' | 'Mesai' | 'Evrak' | 'Düzenle' | null;
type TabType = 'izinler' | 'mesailer' | 'belgeler' | 'notlar' | 'performans';

export default function PersonnelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [emp, setEmp] = useState<Employee | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>(MOCK_LEDGER);
  const [leaves, setLeaves] = useState<LeaveRecord[]>(MOCK_LEAVES);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>(MOCK_OVERTIMES);
  const [docs, setDocs] = useState<DocumentRecord[]>(MOCK_DOCS);
  const [notes] = useState<NoteRecord[]>(MOCK_NOTES);
  const [perfs] = useState<PerformRecord[]>(MOCK_PERF);
  const [modal, setModal] = useState<ModalType>(null);
  const [tab, setTab] = useState<TabType>('izinler');
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const found = MOCK_EMPLOYEES.find(e => e.id === id);
    setEmp(found ? { ...found } : null);
  }, [id]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Kümülatif bakiye hesapla
  const ledgerWithBalance = useMemo(() => {
    let running = 0;
    return [...ledger].reverse().map(e => {
      running += e.credit - e.debit;
      return { ...e, runningBalance: running };
    }).reverse();
  }, [ledger]);

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
              <span className="text-xl font-bold text-blue-600">{emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
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
              { label: 'Bakiye', value: emp.balance === 0 ? '—' : (emp.balance > 0 ? '+' : '') + formatMoney(emp.balance, emp.currency), color: emp.balance < 0 ? 'text-red-600' : emp.balance > 0 ? 'text-green-600' : 'text-gray-700' },
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">Kasa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ledgerWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ENTRY_COLORS[e.type]}`}>{e.type}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-[160px] truncate">{e.description}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{e.debit > 0 ? formatMoney(e.debit) : '—'}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{e.credit > 0 ? formatMoney(e.credit) : '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${e.runningBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatMoney(e.runningBalance)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{e.account}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Tabs */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4 overflow-y-auto max-h-[500px]">

              {tab === 'izinler' && (
                <div className="space-y-2">
                  {leaves.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">İzin kaydı yok</p> :
                    leaves.map(l => (
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
                    overtimes.map(o => (
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
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800 font-medium">{d.name}</p>
                            <p className="text-xs text-gray-400">{d.docType} · {formatDate(d.date)}</p>
                          </div>
                        </div>
                        <button className="text-xs text-blue-600 hover:underline ml-2">İndir</button>
                      </div>
                    ))}
                </div>
              )}

              {tab === 'notlar' && (
                <div className="space-y-3">
                  {notes.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Not yok</p> :
                    notes.map(n => (
                      <div key={n.id} className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-sm text-gray-700">{n.content}</p>
                        <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.date)} · {n.createdBy}</p>
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
      {(modal === 'Maaş' || modal === 'Avans' || modal === 'Prim' || modal === 'Kesinti') && (
        <PaymentModal
          type={modal as PaymentModalType}
          emp={emp}
          onClose={() => setModal(null)}
          onSave={entry => {
            setLedger(p => [entry, ...p]);
            setEmp(e => e ? { ...e, balance: e.balance + entry.credit - entry.debit, lastPaymentDate: entry.date } : e);
            setModal(null);
            showToast(`${modal} işlemi kaydedildi.`);
          }}
        />
      )}
      {modal === 'İzin' && (
        <LeaveModal
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
          onClose={() => setModal(null)}
          onSave={record => {
            setDocs(p => [record, ...p]);
            setModal(null);
            setTab('belgeler');
            showToast('Belge eklendi.');
          }}
        />
      )}
      {modal === 'Düzenle' && (
        <EditModal
          emp={emp}
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
