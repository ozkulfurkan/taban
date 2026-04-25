'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import {
  UserCheck, Plus, Search, X, ChevronRight, Loader2,
  AlertCircle, CheckCircle2, Users
} from 'lucide-react';
import type { Employee } from '@/app/personnel/data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPaydaySoon(payday: number): boolean {
  const today = new Date();
  const current = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let diff = payday - current;
  if (diff < 0) diff += daysInMonth;
  return diff <= 7;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

function formatMoney(n: number, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ' + currency;
}

// ─── Add Employee Modal ───────────────────────────────────────────────────────

function AddEmployeeModal({ onClose, onSave }: { onClose: () => void; onSave: (emp: Employee) => void }) {
  const [form, setForm] = useState({ name: '', department: '', role: '', salary: '', currency: 'TRY', hireDate: '', payday: '1', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => { setForm(p => ({ ...p, [k]: v })); if (v) setFieldErrors(p => ({ ...p, [k]: '' })); };

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name) errs.name = 'Zorunlu alan';
    if (!form.department) errs.department = 'Zorunlu alan';
    if (!form.role) errs.role = 'Zorunlu alan';
    if (!form.salary) errs.salary = 'Zorunlu alan';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Kayıt başarısız');
      const emp = await res.json();
      onSave(emp);
    } catch {
      setErr('Kayıt sırasında hata oluştu.');
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';
  const errCls = 'w-full px-3 py-2 border border-red-400 ring-1 ring-red-400 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Yeni Personel Ekle</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad <span className="text-red-500">*</span></label>
              <input className={fieldErrors.name ? errCls : inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ahmet Yılmaz" />
              {fieldErrors.name && <p className="mt-0.5 text-xs text-red-500">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Departman <span className="text-red-500">*</span></label>
              <input className={fieldErrors.department ? errCls : inputCls} value={form.department} onChange={e => set('department', e.target.value)} placeholder="Üretim" />
              {fieldErrors.department && <p className="mt-0.5 text-xs text-red-500">{fieldErrors.department}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Görev <span className="text-red-500">*</span></label>
              <input className={fieldErrors.role ? errCls : inputCls} value={form.role} onChange={e => set('role', e.target.value)} placeholder="Operatör" />
              {fieldErrors.role && <p className="mt-0.5 text-xs text-red-500">{fieldErrors.role}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Maaş <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" className={fieldErrors.salary ? errCls : inputCls} value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="25000" />
              {fieldErrors.salary && <p className="mt-0.5 text-xs text-red-500">{fieldErrors.salary}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Para Birimi</label>
              <select className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['TRY', 'USD', 'EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">İşe Giriş</label>
              <input type="date" className={inputCls} value={form.hireDate} onChange={e => set('hireDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Maaş Günü</label>
              <input type="number" min="1" max="31" className={inputCls} value={form.payday} onChange={e => set('payday', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
              <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0532 111 2233" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-posta</label>
              <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="ad@firma.com" />
            </div>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-2">
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

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[140, 100, 120, 90, 70, 100, 80, 60].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PersonnelPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'left'>('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [paydaySoon, setPaydaySoon] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personnel');
      if (res.ok) setEmployees(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const departments = useMemo(() => Array.from(new Set(employees.map(e => e.department))).sort(), [employees]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.department.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (deptFilter && e.department !== deptFilter) return false;
      if (paydaySoon && !isPaydaySoon(e.payday)) return false;
      return true;
    });
  }, [employees, search, statusFilter, deptFilter, paydaySoon]);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Personel Takip</h1>
              <p className="text-sm text-gray-500">{employees.filter(e => e.status === 'active').length} aktif personel</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Yeni Personel</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Ara</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ad, departman, görev..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Durum</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="left">Ayrılan</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Departman</label>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tümü</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paydaySoon}
              onChange={e => setPaydaySoon(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-gray-700">Maaş Günü Yaklaşan</span>
          </label>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Departman</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Görev</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Maaş</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Durum</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Son Ödeme</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Bakiye</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading
                  ? Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-400">
                            <Users className="w-10 h-10" />
                            <p className="text-sm">Personel bulunamadı</p>
                          </div>
                        </td>
                      </tr>
                    )
                    : filtered.map(emp => (
                      <tr
                        key={emp.id}
                        onClick={() => router.push('/personnel/' + emp.id)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-blue-600">{emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{emp.name}</p>
                              {emp.phone && <p className="text-xs text-gray-400">{emp.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.role}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{formatMoney(emp.salary, emp.currency)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {emp.status === 'active' ? 'Aktif' : 'Ayrıldı'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <div>
                            {formatDate(emp.lastPaymentDate)}
                            {isPaydaySoon(emp.payday) && emp.status === 'active' && (
                              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Yaklaşıyor</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${emp.balance < 0 ? 'text-red-600' : emp.balance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                          {emp.balance === 0 ? '—' : (emp.balance > 0 ? '+' : '') + formatMoney(emp.balance, emp.currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); router.push('/personnel/' + emp.id); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            Detay <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add Modal */}
      {showAdd && (
        <AddEmployeeModal
          onClose={() => setShowAdd(false)}
          onSave={emp => {
            setEmployees(p => [...p, emp]);
            setShowAdd(false);
            showToast(emp.name + ' eklendi.');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </AppShell>
  );
}
