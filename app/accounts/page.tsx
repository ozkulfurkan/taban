'use client';

import { useEffect, useRef, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { Plus, ChevronDown, Loader2, Pencil, Trash2, X, Save, Landmark } from 'lucide-react';

const ACCOUNT_TYPES = ['Kasa', 'Banka', 'POS'];
const CURRENCIES = ['TRY', 'USD', 'EUR'];
const COLORS = [
  { label: 'Mavi', value: '#3B82F6' },
  { label: 'Yeşil', value: '#10B981' },
  { label: 'Turuncu', value: '#F59E0B' },
  { label: 'Kırmızı', value: '#EF4444' },
  { label: 'Mor', value: '#8B5CF6' },
  { label: 'Gri', value: '#6B7280' },
];

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  color: string;
};

function AccountModal({
  initial,
  typeOverride,
  onClose,
  onSaved,
}: {
  initial?: Account | null;
  typeOverride?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? typeOverride ?? 'Kasa',
    currency: initial?.currency ?? 'TRY',
    balance: initial != null ? String(initial.balance) : '0',
    color: initial?.color ?? '#3B82F6',
  });
  const [saving, setSaving] = useState(false);

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await fetch(isEdit ? `/api/accounts/${initial!.id}` : '/api/accounts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="rounded-t-2xl px-5 py-4 flex items-center justify-between" style={{ backgroundColor: form.color }}>
          <h3 className="text-white font-semibold">{isEdit ? 'Hesabı Düzenle' : `${form.type} Ekle`}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tanım *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Örn. TL Kasa, Garanti TL"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hesap Türü</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} disabled={!!typeOverride && !isEdit}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500">
              {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Para Birimi</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Güncel Bakiye</label>
              <input type="number" step="0.01" value={form.balance} onChange={e => set('balance', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Etiket Rengi</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => set('color', c.value)}
                  title={c.label}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c.value,
                    borderColor: form.color === c.value ? '#1e293b' : 'transparent',
                    transform: form.color === c.value ? 'scale(1.2)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatted = account.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

  return (
    <div ref={ref} className="relative bg-white rounded-xl shadow-sm border-l-4 p-4 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeftColor: account.color }}
      onClick={() => setShowMenu(s => !s)}>
      <p className="text-sm font-semibold text-slate-700 truncate">{account.name}</p>
      <p className="text-base font-bold mt-1" style={{ color: account.color }}>
        {account.currency} {formatted}
      </p>
      {showMenu && (
        <div className="absolute right-2 top-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Pencil className="w-3.5 h-3.5" /> Düzenle
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Sil
          </button>
        </div>
      )}
    </div>
  );
}

function groupTotals(accounts: Account[], type: string) {
  const filtered = accounts.filter(a => a.type === type);
  const byCurrency: Record<string, number> = {};
  filtered.forEach(a => { byCurrency[a.currency] = (byCurrency[a.currency] || 0) + a.balance; });
  return Object.entries(byCurrency).map(([cur, bal]) =>
    `${cur} ${bal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
  ).join(' · ');
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: Account | null; typeOverride?: string }>({ open: false });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    load();
  };

  const openAdd = (type: string) => { setDropdownOpen(false); setModal({ open: true, edit: null, typeOverride: type }); };

  const sections: { type: string; label: string }[] = [
    { type: 'Kasa', label: 'KASA' },
    { type: 'Banka', label: 'BANKA HESAPLARI' },
    { type: 'POS', label: 'POS HESAPLARI' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Hesaplarım</h1>
            <p className="text-slate-500 text-sm">{accounts.length} hesap</p>
          </div>
          <div ref={dropRef} className="relative">
            <button onClick={() => setDropdownOpen(d => !d)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Yeni Hesap Ekle <ChevronDown className="w-4 h-4" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[180px]">
                {ACCOUNT_TYPES.map(t => (
                  <button key={t} onClick={() => openAdd(t)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
                    <Landmark className="w-4 h-4 text-slate-400" /> {t} Ekle
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className="space-y-8">
            {sections.map(({ type, label }) => {
              const items = accounts.filter(a => a.type === type);
              if (items.length === 0) return null;
              const totals = groupTotals(accounts, type);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</h2>
                    {totals && <span className="text-xs text-slate-500 font-medium">{totals}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map(a => (
                      <AccountCard key={a.id} account={a}
                        onEdit={() => setModal({ open: true, edit: a })}
                        onDelete={() => handleDelete(a.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
            {accounts.length === 0 && (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm">
                <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">Henüz hesap eklenmedi</p>
                <p className="text-sm text-slate-400 mt-1">Yukarıdaki butonu kullanarak kasa veya banka hesabı ekleyin</p>
              </div>
            )}
          </div>
        )}
      </div>

      {modal.open && (
        <AccountModal
          initial={modal.edit}
          typeOverride={modal.typeOverride}
          onClose={() => setModal({ open: false })}
          onSaved={load}
        />
      )}
    </AppShell>
  );
}
