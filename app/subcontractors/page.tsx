'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Plus, Loader2, X, Factory, CheckCircle2, XCircle } from 'lucide-react';

export default function SubcontractorsPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', address: '', email: '' });

  const load = () => {
    setLoading(true);
    fetch('/api/subcontractors')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setList(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: '', contactPerson: '', phone: '', address: '', email: '' });
        load();
      }
    } finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-orange-600" />
            <h1 className="text-lg font-bold text-slate-800">Fasoncular</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Yeni Fasoncu
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-slate-400">Henüz fasoncu tanımlanmadı</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Fasoncu</th>
                  <th className="px-4 py-3 text-left">İletişim</th>
                  <th className="px-4 py-3 text-left">E-posta</th>
                  <th className="px-4 py-3 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/subcontractors/${s.id}`} className="block">
                        <p className="font-semibold text-slate-700">{s.name}</p>
                        {s.contactPerson && <p className="text-xs text-slate-400">{s.contactPerson}</p>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.phone || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{s.email || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      {s.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Pasif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-600 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Factory className="w-4 h-4" /> Yeni Fasoncu
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: 'name', label: 'Firma Adı *', placeholder: 'örn: ABC Üretim Ltd.' },
                { key: 'contactPerson', label: 'İletişim Kişisi', placeholder: 'örn: Ahmet Yılmaz' },
                { key: 'phone', label: 'Telefon', placeholder: '+90 555 000 00 00' },
                { key: 'email', label: 'E-posta', placeholder: 'info@firma.com' },
                { key: 'address', label: 'Adres', placeholder: 'Adres...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    value={(form as any)[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Oluştur
                </button>
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
