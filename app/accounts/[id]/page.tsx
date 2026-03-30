'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  ArrowLeft, Loader2, Pencil, TrendingDown, TrendingUp,
  ArrowLeftRight, ChevronDown, Trash2, X, Save, FileText,
} from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR');

const ISLEM_LABEL: Record<string, string> = {
  'Para Girişi': 'Para Girişi',
  'Para Çıkışı': 'Para Çıkışı',
  'Transfer': 'Transfer',
  'Nakit': 'Nakit',
  'Havale/EFT': 'Havale/EFT',
  'Çek': 'Çek',
  'Senet': 'Senet',
  'Kredi Kartı': 'Kredi Kartı',
  'POS': 'POS',
};

function getIslemLabel(p: any) {
  if (p.method === 'Para Girişi' || p.method === 'Para Çıkışı' || p.method === 'Transfer') return p.method;
  if (p.customer) return 'Tahsilat';
  if (p.supplier) return 'Ödeme';
  return p.method || 'İşlem';
}

// ── Modal: Para Girişi / Para Çıkışı ──────────────────────────────────────────
function HesapIslemModal({
  accountId, type, onClose, onSaved,
}: { accountId: string; type: 'GİRİŞ' | 'ÇIKIŞ'; onClose: () => void; onSaved: () => void }) {
  const isGiris = type === 'GİRİŞ';
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          amount: form.amount,
          date: form.date,
          notes: form.notes || null,
          method: isGiris ? 'Para Girişi' : 'Para Çıkışı',
          // Para girişi → type RECEIVED (bakiye artar), çıkış → PAID (bakiye azalır)
          // type, /api/payments POST içinde customerId/supplierId'ye göre otomatik belirlenir
          // Ama burada ikisi de yok → customerId yoksa type=PAID olur, bu yanlış olur
          // Para Girişi için customerId='__giris__' gibi sahte bir şey kullanamayız
          // Bu yüzden type'ı direkt gönderelim (API'yi genişleteceğiz)
          _type: isGiris ? 'RECEIVED' : 'PAID',
        }),
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className={`rounded-t-2xl px-5 py-4 flex items-center justify-between ${isGiris ? 'bg-green-600' : 'bg-red-600'}`}>
          <h3 className="text-white font-semibold">{isGiris ? 'Hesaba Para Girişi' : 'Hesaptan Para Çıkışı'}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tutar</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tarih</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Opsiyonel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving || !form.amount}
              className={`flex-1 py-2 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${isGiris ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Hesaplar Arası Transfer ────────────────────────────────────────────
function TransferModal({
  sourceAccountId, allAccounts, onClose, onSaved,
}: { sourceAccountId: string; allAccounts: any[]; onClose: () => void; onSaved: () => void }) {
  const others = allAccounts.filter(a => a.id !== sourceAccountId);
  const [form, setForm] = useState({
    targetId: others[0]?.id || '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0 || !form.targetId) return;
    setSaving(true);
    try {
      const notes = form.notes ? `Transfer${form.notes ? ` — ${form.notes}` : ''}` : 'Transfer';
      // Çıkış (kaynak hesaptan düş)
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: sourceAccountId,
          amount: form.amount,
          date: form.date,
          method: 'Transfer',
          notes: `${notes} → ${allAccounts.find(a => a.id === form.targetId)?.name || ''}`,
          _type: 'PAID',
        }),
      });
      // Giriş (hedef hesaba ekle)
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: form.targetId,
          amount: form.amount,
          date: form.date,
          method: 'Transfer',
          notes: `${notes} ← ${allAccounts.find(a => a.id === sourceAccountId)?.name || ''}`,
          _type: 'RECEIVED',
        }),
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="rounded-t-2xl px-5 py-4 flex items-center justify-between bg-orange-500">
          <h3 className="text-white font-semibold">Hesaplar Arası Transfer</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hedef Hesap</label>
            <select value={form.targetId} onChange={e => set('targetId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white">
              {others.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tutar</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none text-right" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tarih</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Opsiyonel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving || !form.amount || !form.targetId}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Transferi Yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Hesap Düzenle ──────────────────────────────────────────────────────
function EditAccountModal({
  account, onClose, onSaved,
}: { account: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: account.name,
    currency: account.currency,
    balance: String(account.balance),
    color: account.color,
  });
  const [saving, setSaving] = useState(false);
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));
  const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#6B7280'];

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="rounded-t-2xl px-5 py-4 flex items-center justify-between" style={{ backgroundColor: form.color }}>
          <h3 className="text-white font-semibold">Hesabı Güncelle</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hesap Adı</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Para Birimi</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bakiye</label>
              <input type="number" step="0.01" value={form.balance} onChange={e => set('balance', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none text-right" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Renk</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.color === c ? '#1e293b' : 'transparent', transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Güncelle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function AccountEkstrePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [transferDropdown, setTransferDropdown] = useState(false);
  const [modal, setModal] = useState<'giris' | 'cikis' | 'transfer' | 'edit' | null>(null);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${params.id}/ekstre`);
      setData(await res.json());
    } finally { setLoading(false); }
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Bu işlem silinecek. Emin misiniz?')) return;
    setOpenRowMenu(null);
    await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    load();
  };

  const account = data?.account;
  const allAccounts = data?.allAccounts || [];
  const payments: any[] = data?.payments || [];

  // Running balance from start, newest first for display
  const rows: any[] = [];
  let balance = 0;
  payments.forEach(p => {
    const isIn = p.type === 'RECEIVED';
    balance += isIn ? p.amount : -p.amount;
    rows.push({ ...p, runningBalance: balance });
  });
  const displayRows = [...rows].reverse(); // newest first

  const filtered = search
    ? displayRows.filter(r =>
        r.method?.toLowerCase().includes(search.toLowerCase()) ||
        r.notes?.toLowerCase().includes(search.toLowerCase()) ||
        r.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.supplier?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : displayRows;

  return (
    <AppShell>
      <div className="space-y-4">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Header */}
        {account && (
          <div className="rounded-xl px-6 py-4 flex items-center gap-4"
            style={{ backgroundColor: account.color }}>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">₺</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">{account.name}</h1>
              <p className="text-white/80 text-sm">Bakiye : {fmt(account.balance)}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal('edit')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Pencil className="w-4 h-4" /> Güncelle
          </button>
          <button onClick={() => setModal('giris')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
            <TrendingDown className="w-4 h-4" /> Hesaba Para Girişi Yap
          </button>
          <button onClick={() => setModal('cikis')}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
            <TrendingUp className="w-4 h-4" /> Hesaptan Para Çıkışı Yap
          </button>
          <div className="relative">
            <button onClick={() => setTransferDropdown(d => !d)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-400 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors">
              <ArrowLeftRight className="w-4 h-4" /> Hesaplar Arası Transfer <ChevronDown className="w-3 h-3" />
            </button>
            {transferDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTransferDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[220px] overflow-hidden">
                  {allAccounts.filter((a: any) => a.id !== params?.id).map((a: any) => (
                    <button key={a.id}
                      onClick={() => { setTransferDropdown(false); setModal('transfer'); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </button>
                  ))}
                  {allAccounts.filter((a: any) => a.id !== params?.id).length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-400">Başka hesap yok</p>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
            <FileText className="w-4 h-4" /> Dökümanlar
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-700">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide">HESAP HAREKETLERİ</h2>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 justify-end">
            <span className="text-sm text-slate-500 font-medium">Bul:</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 w-64" />
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">İşlem bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[850px]">
                <thead>
                  <tr className="text-xs font-semibold text-slate-600 border-b bg-green-50">
                    <th className="px-3 py-2.5 text-left cursor-pointer hover:text-slate-800">Tarih ▼</th>
                    <th className="px-3 py-2.5 text-left">İşlem</th>
                    <th className="px-3 py-2.5 text-left">Hesap</th>
                    <th className="px-3 py-2.5 text-left">Açıklama</th>
                    <th className="px-3 py-2.5 text-right">Borç</th>
                    <th className="px-3 py-2.5 text-right">Alacak</th>
                    <th className="px-3 py-2.5 text-right">Bakiye</th>
                    <th className="px-3 py-2.5 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const isIn = row.type === 'RECEIVED';
                    const hesap = row.customer?.name || row.supplier?.name || '';
                    const islemLabel = getIslemLabel(row);
                    return (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            islemLabel === 'Para Girişi' || islemLabel === 'Tahsilat' ? 'bg-green-100 text-green-700' :
                            islemLabel === 'Para Çıkışı' || islemLabel === 'Ödeme' ? 'bg-red-100 text-red-700' :
                            islemLabel === 'Transfer' ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{islemLabel}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{hesap || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-[220px] truncate">{row.notes || ''}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                          {isIn ? fmt(row.amount) : ''}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                          {!isIn ? fmt(row.amount) : ''}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${row.runningBalance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {fmt(row.runningBalance)}
                        </td>
                        <td className="px-3 py-2.5 text-center relative">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setOpenRowMenu(openRowMenu === row.id ? null : row.id)}
                              className="px-3 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded-lg">
                              İşlem ▾
                            </button>
                            {openRowMenu === row.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenRowMenu(null)} />
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[140px] overflow-hidden">
                                  <button
                                    onClick={() => handleDeletePayment(row.id)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5" /> Sil
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'edit' && account && (
        <EditAccountModal account={account} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal === 'giris' && account && (
        <HesapIslemModal accountId={account.id} type="GİRİŞ" onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal === 'cikis' && account && (
        <HesapIslemModal accountId={account.id} type="ÇIKIŞ" onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal === 'transfer' && account && (
        <TransferModal sourceAccountId={account.id} allAccounts={allAccounts} onClose={() => setModal(null)} onSaved={load} />
      )}
    </AppShell>
  );
}
