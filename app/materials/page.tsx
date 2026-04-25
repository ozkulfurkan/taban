'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Modal from '@/app/components/modal';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSession } from 'next-auth/react';
import { Package, Plus, Search, Loader2, Tag } from 'lucide-react';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';
import { motion } from 'framer-motion';

export default function MaterialsPage() {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const { t, formatAmount, currency } = useLanguage();
  const user = session?.user as any;
  const canEdit = user?.role !== 'VIEWER';

  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', supplier: '', pricePerKg: '', currency: 'USD', description: '' });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/materials?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setMaterials(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const openNew = () => {
    setForm({ name: '', category: '', supplier: '', pricePerKg: '', currency, description: '' });
    setNameError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setNameError('Hammadde adı zorunludur.'); return; }
    setNameError('');
    setSaving(true);
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pricePerKg: fromPriceInput(form.pricePerKg) }),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchMaterials();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('materials', 'title')}</h1>
            <p className="text-slate-500 text-sm">{t('common', 'materials')}</p>
          </div>
          {canEdit && (
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              {t('materials', 'addMaterial')}
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common', 'search') + '...'}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {Array.from(new Set(materials.map((m: any) => m.category).filter(Boolean))).length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">Tüm Kategoriler</option>
              {Array.from(new Set(materials.map((m: any) => m.category).filter(Boolean))).sort().map((cat: any) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !materials?.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{t('materials', 'noMaterials')}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {(materials ?? [])
              .filter((mat: any) => !categoryFilter || mat.category === categoryFilter)
              .map((mat: any, i: number) => (
              <motion.div
                key={mat?.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/materials/${mat.id}`)}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800 truncate">{mat?.name ?? ''}</p>
                        {mat?.category && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-medium flex-shrink-0">
                            <Tag className="w-3 h-3" />{mat.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{mat?.supplier ?? '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="font-semibold text-slate-800">{formatAmount(mat?.pricePerKg ?? 0, mat?.currency ?? 'USD')}/kg</p>
                      <p className="text-xs text-slate-400">{mat?.currency ?? ''}</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className={`font-semibold text-sm ${(mat?.stock ?? 0) <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {(mat?.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </p>
                      <p className="text-xs text-slate-400">Stok</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Yeni Hammadde Ekle Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('materials', 'addMaterial')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'materialName')} <span className="text-red-500">*</span></label>
            <input value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (e.target.value.trim()) setNameError(''); }}
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${nameError ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'}`} />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kategori (opsiyonel)</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ör: Taban, Astar, Bağcık" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'supplier')}</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'pricePerKg')}</label>
              <input type="text" inputMode="decimal" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: normalizePriceInput(e.target.value) })} onKeyDown={blockDot} placeholder="0,00" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('common', 'currency')}</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium">
              {t('common', 'cancel')}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common', 'save')}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
