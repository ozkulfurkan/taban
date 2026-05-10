'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';

export default function NewSupplierPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', taxId: '', email: '', phone: '', address: '', currency: 'USD', notes: '' });
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    fetch('/api/supplier-categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }, []);

  const set = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const res = await fetch('/api/supplier-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const cat = await res.json();
      if (cat.id) {
        setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
        setCategoryId(cat.id);
        setNewCatName('');
        setShowAddCat(false);
      }
    } finally { setSavingCat(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, categoryId: categoryId || null }),
      });
      const data = await res.json();
      if (data.id) router.push(`/suppliers/${data.id}`);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{t('suppliers', 'newSupplierTitle')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers', 'companyNameLabel')}</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Para Birimi *</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Kaydedildikten sonra değiştirilemez</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers', 'taxId')}</label>
              <input value={form.taxId} onChange={e => set('taxId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            {/* Kategori */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Kategori</label>
              <div className="flex gap-2">
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">— Kategori seçin (isteğe bağlı) —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddCat(v => !v)}
                  title="Yeni kategori ekle"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showAddCat && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                    placeholder="Kategori adı"
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <button type="button" onClick={addCategory} disabled={savingCat || !newCatName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1">
                    {savingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ekle'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers', 'phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers', 'email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers', 'address')}</label>
              <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers', 'notes')}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">{t('common', 'cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
