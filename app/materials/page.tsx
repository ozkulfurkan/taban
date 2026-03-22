'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/app/components/app-shell';
import Modal from '@/app/components/modal';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSession } from 'next-auth/react';
import { Package, Plus, Search, Edit2, Trash2, History, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MaterialsPage() {
  const { data: session } = useSession() || {};
  const { t, formatCurrency, currency } = useLanguage();
  const user = session?.user as any;
  const canEdit = user?.role !== 'VIEWER';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER';

  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [historyModal, setHistoryModal] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', supplier: '', pricePerKg: '', currency: 'USD', description: '' });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', supplier: '', pricePerKg: '', currency, description: '' });
    setModalOpen(true);
  };

  const openEdit = (mat: any) => {
    setEditItem(mat);
    setForm({
      name: mat?.name ?? '',
      supplier: mat?.supplier ?? '',
      pricePerKg: String(mat?.pricePerKg ?? ''),
      currency: mat?.currency ?? 'USD',
      description: mat?.description ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editItem ? `/api/materials/${editItem.id}` : '/api/materials';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  const handleDelete = async (id: string) => {
    if (!confirm(t('common', 'confirm') + '?')) return;
    try {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      fetchMaterials();
    } catch (e) {
      console.error(e);
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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common', 'search') + '...'}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
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
            {(materials ?? []).map((mat: any, i: number) => (
              <motion.div
                key={mat?.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{mat?.name ?? ''}</p>
                    <p className="text-xs text-slate-400">{mat?.supplier ?? '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{formatCurrency(mat?.pricePerKg ?? 0)}/kg</p>
                    <p className="text-xs text-slate-400">{mat?.currency ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setHistoryModal(mat)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('materials', 'priceHistory')}
                    >
                      <History className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => openEdit(mat)}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(mat?.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('materials', 'editMaterial') : t('materials', 'addMaterial')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'materialName')}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'supplier')}</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('materials', 'pricePerKg')}</label>
              <input type="number" step="0.01" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
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

      {/* Price History Modal */}
      <Modal isOpen={!!historyModal} onClose={() => setHistoryModal(null)} title={`${historyModal?.name ?? ''} - ${t('materials', 'priceHistory')}`}>
        <div className="space-y-2">
          {!(historyModal?.priceHistory ?? [])?.length ? (
            <p className="text-slate-400 text-center py-4">{t('common', 'noData')}</p>
          ) : (
            (historyModal?.priceHistory ?? []).map((h: any, i: number) => (
              <div key={h?.id ?? i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">
                  {h?.createdAt ? new Date(h.createdAt).toLocaleDateString() : '-'}
                </span>
                <span className="font-medium text-slate-800">
                  {formatCurrency(h?.pricePerKg ?? 0)}/kg
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
