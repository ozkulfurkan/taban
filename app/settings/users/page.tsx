'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useSession } from 'next-auth/react';
import {
  Users, Plus, Loader2, Trash2, Edit2, Key, X, Save, Eye, EyeOff, Copy, CheckCircle, Shield, AlertTriangle
} from 'lucide-react';

const ALL_PAGES = [
  { key: 'dashboard', label: 'Ana Sayfa' },
  { key: 'customers', label: 'Müşteriler' },
  { key: 'suppliers', label: 'Tedarikçiler' },
  { key: 'invoices', label: 'Satışlar' },
  { key: 'payments', label: 'Ödemeler' },
  { key: 'products', label: 'Ürünler' },
  { key: 'materials', label: 'Hammaddeler' },
  { key: 'accounts', label: 'Hesaplarım' },
  { key: 'cek-portfolyo', label: 'Çek Portföyü' },
  { key: 'calculations', label: 'Taban Maliyet Hesapla' },
  { key: 'settings', label: 'Ayarlar' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Sistem Yöneticisi',
  COMPANY_OWNER: 'Firma Yöneticisi',
  EDITOR: 'Editör',
  VIEWER: 'Görüntüleyici',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  COMPANY_OWNER: 'bg-blue-100 text-blue-700',
  EDITOR: 'bg-emerald-100 text-emerald-700',
  VIEWER: 'bg-slate-100 text-slate-600',
};

const ASSIGNABLE_ROLES = ['COMPANY_OWNER', 'EDITOR', 'VIEWER'];

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  allowedPages: string[];
  createdAt: string;
}

function hasFullAccess(role: string) {
  return role === 'ADMIN' || role === 'COMPANY_OWNER';
}

// ─── Add User Modal ───────────────────────────────────────────────
function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState('EDITOR');
  const [allowedPages, setAllowedPages] = useState<string[]>(ALL_PAGES.map(p => p.key));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePage = (key: string) =>
    setAllowedPages(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);

  const handleSave = async () => {
    if (!email || !password) { setError('E-posta ve şifre zorunlu'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, allowedPages: hasFullAccess(role) ? [] : allowedPages }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Hata'); return; }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Yeni Kullanıcı Ekle</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ad Soyad</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ad Soyad"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Rol</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">E-posta *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Şifre *</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!hasFullAccess(role) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Sayfa İzinleri</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button"
                  onClick={() => setAllowedPages(allowedPages.length === ALL_PAGES.length ? [] : ALL_PAGES.map(p => p.key))}
                  className="col-span-2 text-xs text-blue-600 hover:underline text-left mb-1">
                  {allowedPages.length === ALL_PAGES.length ? 'Tümünü kaldır' : 'Tümünü seç'}
                </button>
                {ALL_PAGES.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={allowedPages.includes(p.key)} onChange={() => togglePage(p.key)}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-slate-700 group-hover:text-blue-600">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {hasFullAccess(role) && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              Firma Yöneticisi tüm sayfalara tam erişime sahiptir.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">İptal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name || '');
  const [role, setRole] = useState(user.role);
  const [allowedPages, setAllowedPages] = useState<string[]>(
    hasFullAccess(user.role) ? ALL_PAGES.map(p => p.key) : user.allowedPages
  );
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const togglePage = (key: string) =>
    setAllowedPages(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = { name, role, allowedPages: hasFullAccess(role) ? [] : allowedPages };
      if (newPassword) {
        if (newPassword.length < 6) { setError('Şifre en az 6 karakter olmalı'); setSaving(false); return; }
        body.newPassword = newPassword;
      }
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Hata'); return; }
      onSaved();
    } finally { setSaving(false); }
  };

  const generateResetLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateResetToken: true }),
      });
      const data = await res.json();
      if (data.resetToken) {
        const url = `${window.location.origin}/reset-password?token=${data.resetToken}`;
        setResetUrl(url);
      }
    } finally { setGeneratingLink(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Kullanıcıyı Düzenle</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 font-medium">{user.email}</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ad Soyad</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Rol</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>

          {!hasFullAccess(role) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Sayfa İzinleri</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button"
                  onClick={() => setAllowedPages(allowedPages.length === ALL_PAGES.length ? [] : ALL_PAGES.map(p => p.key))}
                  className="col-span-2 text-xs text-blue-600 hover:underline text-left mb-1">
                  {allowedPages.length === ALL_PAGES.length ? 'Tümünü kaldır' : 'Tümünü seç'}
                </button>
                {ALL_PAGES.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={allowedPages.includes(p.key)} onChange={() => togglePage(p.key)}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-slate-700 group-hover:text-blue-600">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {hasFullAccess(role) && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              Firma Yöneticisi tüm sayfalara tam erişime sahiptir.
            </p>
          )}

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Yeni Şifre Belirle (isteğe bağlı)</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Değiştirmek için girin"
                className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Şifre Sıfırlama Bağlantısı</p>
            {!resetUrl ? (
              <button onClick={generateResetLink} disabled={generatingLink}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Bağlantı Oluştur (24 saat geçerli)
              </button>
            ) : (
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 break-all text-xs text-slate-600 font-mono">
                  {resetUrl}
                </div>
                <button onClick={handleCopy}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Kopyalandı!' : 'Kopyala'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">İptal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function UsersPage() {
  const { data: session } = useSession() || {};
  const currentUser = session?.user as any;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (user: User) => {
    setConfirmModal({ message: `"${user.name || user.email}" kullanıcısını silmek istediğinize emin misiniz?`, onConfirm: async () => {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error); return; }
      load();
    }});
  };

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'COMPANY_OWNER';

  if (!canManage) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Shield className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Erişim Kısıtlı</h2>
          <p className="text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load(); }} />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
            <p className="text-slate-500 text-sm">{users.length} kullanıcı</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Yeni Kullanıcı
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">Henüz kullanıcı yok</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Ad / E-posta</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Sayfa İzinleri</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{u.name || '—'}</p>
                      <p className="text-slate-400 text-xs">{u.email}</p>
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-blue-500 font-medium">(siz)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {hasFullAccess(u.role) ? (
                        <span className="text-xs text-slate-400 italic">Tam erişim</span>
                      ) : u.allowedPages.length === 0 ? (
                        <span className="text-xs text-red-400 italic">Erişim yok</span>
                      ) : u.allowedPages.length === ALL_PAGES.length ? (
                        <span className="text-xs text-emerald-600 italic">Tüm sayfalar</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.allowedPages.slice(0, 4).map(p => {
                            const pg = ALL_PAGES.find(x => x.key === p);
                            return (
                              <span key={p} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {pg?.label || p}
                              </span>
                            );
                          })}
                          {u.allowedPages.length > 4 && (
                            <span className="text-xs text-slate-400">+{u.allowedPages.length - 4} daha</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditUser(u)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">Rol Açıklamaları</p>
          <ul className="space-y-1 text-xs text-blue-600">
            <li><strong>Firma Yöneticisi:</strong> Tüm sayfalara tam erişim, kullanıcı yönetimi yetkisi</li>
            <li><strong>Editör:</strong> Atanan sayfalarda düzenleme yapabilir</li>
            <li><strong>Görüntüleyici:</strong> Atanan sayfalarda sadece görüntüleme yapabilir</li>
          </ul>
        </div>
      </div>
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Emin misiniz?</h3>
                <p className="text-sm text-slate-600 whitespace-pre-line">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">İptal</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setErrorMsg('')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Hata</h3>
                <p className="text-sm text-slate-600">{errorMsg}</p>
              </div>
            </div>
            <button onClick={() => setErrorMsg('')}
              className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium">
              Tamam
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
