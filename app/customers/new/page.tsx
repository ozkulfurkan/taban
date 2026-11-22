'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Loader2, Plus } from '@/app/components/icons';
import BackLink from '@/app/components/back-link';
import Link from 'next/link';

const CURRENCIES = ['TRY', 'USD', 'EUR'];

export default function NewCustomerPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({ name: '', taxId: '', taxOffice: '', email: '', phone: '', address: '', currency: 'TRY', notes: '' });
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    fetch('/api/customer-categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }, []);

  const set = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const res = await fetch('/api/customer-categories', {
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
      setSaveError('');
      const send = (extra: Record<string, unknown> = {}) => fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, categoryId: categoryId || null, ...extra }),
      });
      let res = await send();
      let data = await res.json();
      // Aynı adlı kayıt varsa sor: onaylanırsa yeni kayıt açılır, vazgeçilirse mevcut kayda gidilir
      if (res.status === 409 && data?.code === 'DUPLICATE_NAME') {
        const createAnyway = window.confirm(
          `${data.error}\n\nYine de yeni bir müşteri kaydı açılsın mı?\n(İptal'e basarsanız mevcut kayıt açılır.)`,
        );
        if (!createAnyway) { router.replace(`/customers/${data.existing.id}`); return; }
        res = await send({ allowDuplicate: true });
        data = await res.json();
      }
      if (!res.ok || !data?.id) { setSaveError(data?.error || 'Kayıt oluşturulamadı'); return; }
      router.replace(`/customers/${data.id}`);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <BackLink variant="icon" href="/customers" label="Müşteriler" />
          <h1 className="page-title">{t('customers', 'newCustomerTitle')}</h1>
        </div>

        {saveError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">{saveError}</div>
        )}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-card p-6 space-y-4 border border-ink-200/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'companyNameLabel')}</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('common', 'currency')} *</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <p className="text-xs text-ink-400 mt-1">{t('customers', 'currencyHint')}</p>
            </div>

            {/* Kategori */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-600 mb-1">Kategori</label>
              <div className="flex gap-2">
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white">
                  <option value="">— Kategori seçin (isteğe bağlı) —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddCat(v => !v)}
                  title="Yeni kategori ekle"
                  className="px-3 py-2 border border-ink-200 rounded-lg text-ink-600 hover:bg-ink-50 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showAddCat && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                    placeholder="Kategori adı"
                    className="flex-1 px-3 py-2 border border-brand-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                  <button type="button" onClick={addCategory} disabled={savingCat || !newCatName.trim()}
                    className="px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1">
                    {savingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ekle'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'taxId')}</label>
              <input value={form.taxId} onChange={e => set('taxId', e.target.value)} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'taxOffice')}</label>
              <input value={form.taxOffice} onChange={e => set('taxOffice', e.target.value)} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'address')}</label>
              <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-600 mb-1">{t('customers', 'notes')}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Link href="/customers" className="px-4 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50 transition-colors inline-flex items-center justify-center">{t('common', 'cancel')}</Link>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common', 'save')}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
