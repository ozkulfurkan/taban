'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/app/components/app-shell';
import Modal from '@/app/components/modal';
import { useLanguage } from '@/lib/i18n/language-context';
import { useSession } from 'next-auth/react';
import {
  Package, Plus, Search, Edit2, Trash2, History, Loader2, Layers,
  ChevronDown, ChevronRight, Palette, X, FileText, TrendingUp, TrendingDown, RotateCcw,
} from 'lucide-react';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Expanded material IDs
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Variant add/edit modal
  const [variantModal, setVariantModal] = useState<{ materialId: string; variant?: any } | null>(null);
  const [variantForm, setVariantForm] = useState({ colorName: '', code: '', stock: '' });
  const [variantSaving, setVariantSaving] = useState(false);

  // Stok güncelleme (for variants and standalone materials)
  const [stokModal, setStokModal] = useState<{ type: 'material' | 'variant'; id: string; materialId?: string; name: string; stock: number } | null>(null);
  const [stokDelta, setStokDelta] = useState('');
  const [stokSign, setStokSign] = useState<1 | -1>(1);
  const [stokSaving, setStokSaving] = useState(false);

  // Stok Ekstresi modal
  const [ekstreModal, setEkstreModal] = useState<{ name: string; data: any } | null>(null);
  const [ekstreLoading, setEkstreLoading] = useState(false);

  const openEkstre = async (mat: any, variant?: any) => {
    const label = variant ? `${mat.name} — ${variant.colorName}${variant.code ? ` (${variant.code})` : ''}` : mat.name;
    setEkstreLoading(true);
    setEkstreModal({ name: label, data: null });
    try {
      const url = variant
        ? `/api/materials/${mat.id}/ekstre?variantId=${variant.id}`
        : `/api/materials/${mat.id}/ekstre`;
      const res = await fetch(url);
      const data = await res.json();
      setEkstreModal({ name: label, data });
    } finally { setEkstreLoading(false); }
  };

  const handleStokSave = async () => {
    if (!stokModal || !stokDelta) return;
    setStokSaving(true);
    try {
      if (stokModal.type === 'material') {
        await fetch(`/api/materials/${stokModal.id}/stok`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta: stokSign * (parseFloat(stokDelta) || 0) }),
        });
      } else {
        // variant stok update via PUT
        const current = stokModal.stock;
        const newStock = current + stokSign * (parseFloat(stokDelta) || 0);
        await fetch(`/api/materials/${stokModal.materialId}/variants/${stokModal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: newStock }),
        });
      }
      setStokModal(null);
      setStokDelta('');
      fetchMaterials();
    } finally { setStokSaving(false); }
  };

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
      pricePerKg: toPriceInput(mat?.pricePerKg ?? ''),
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

  const handleDelete = async (id: string) => {
    if (!confirm(t('common', 'confirm') + '?')) return;
    try {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      fetchMaterials();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openVariantAdd = (materialId: string) => {
    setVariantForm({ colorName: '', code: '', stock: '0' });
    setVariantModal({ materialId });
  };

  const openVariantEdit = (materialId: string, variant: any) => {
    setVariantForm({
      colorName: variant.colorName,
      code: variant.code ?? '',
      stock: String(variant.stock ?? 0),
    });
    setVariantModal({ materialId, variant });
  };

  const handleVariantSave = async () => {
    if (!variantModal || !variantForm.colorName.trim()) return;
    setVariantSaving(true);
    try {
      const { materialId, variant } = variantModal;
      if (variant) {
        await fetch(`/api/materials/${materialId}/variants/${variant.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variantForm),
        });
      } else {
        await fetch(`/api/materials/${materialId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variantForm),
        });
      }
      setVariantModal(null);
      fetchMaterials();
      // keep expanded
      setExpanded(prev => new Set([...Array.from(prev), materialId]));
    } finally {
      setVariantSaving(false);
    }
  };

  const handleVariantDelete = async (materialId: string, variantId: string) => {
    if (!confirm('Renk/kod varyantı silinecek. Emin misiniz?')) return;
    await fetch(`/api/materials/${materialId}/variants/${variantId}`, { method: 'DELETE' });
    fetchMaterials();
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
            {(materials ?? []).map((mat: any, i: number) => {
              const isExpanded = expanded.has(mat.id);
              const variants: any[] = mat.variants ?? [];
              const hasVariants = variants.length > 0;
              const totalVariantStock = variants.reduce((s: number, v: any) => s + (v.stock ?? 0), 0);

              return (
                <motion.div
                  key={mat?.id ?? i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Material header row */}
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Expand button */}
                      <button
                        onClick={() => toggleExpand(mat.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                        title={isExpanded ? 'Kapat' : 'Varyantları Göster'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{mat?.name ?? ''}</p>
                        <p className="text-xs text-slate-400">{mat?.supplier ?? '-'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold text-slate-800">{formatCurrency(mat?.pricePerKg ?? 0)}/kg</p>
                        <p className="text-xs text-slate-400">{mat?.currency ?? ''}</p>
                      </div>

                      {/* Stock display */}
                      {hasVariants ? (
                        <div className="text-right min-w-[90px]">
                          <p className={`font-semibold text-sm ${totalVariantStock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {totalVariantStock.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
                          </p>
                          <p className="text-xs text-slate-400">{variants.length} renk/kod</p>
                        </div>
                      ) : (
                        <div className="text-right min-w-[80px]">
                          <p className={`font-semibold text-sm ${(mat?.stock ?? 0) <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {(mat?.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
                          </p>
                          <p className="text-xs text-slate-400">Stok</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {canEdit && !hasVariants && (
                          <button
                            onClick={() => setStokModal({ type: 'material', id: mat.id, name: mat.name, stock: mat.stock ?? 0 })}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Stok Güncelle"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => { openVariantAdd(mat.id); setExpanded(prev => new Set([...Array.from(prev), mat.id])); }}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Renk/Kod Ekle"
                          >
                            <Palette className="w-4 h-4" />
                          </button>
                        )}
                        {!hasVariants && (
                          <button
                            onClick={() => openEkstre(mat)}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Stok Ekstresi"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
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
                  </div>

                  {/* Variants section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-slate-100"
                      >
                        <div className="px-4 pb-4 pt-3">
                          {variants.length === 0 ? (
                            <p className="text-sm text-slate-400 italic py-1">Henüz renk/kod eklenmemiş</p>
                          ) : (
                            <div className="space-y-1.5">
                              {variants.map((v: any) => (
                                <div key={v.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 truncate">{v.colorName}</span>
                                    {v.code && (
                                      <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded font-mono">{v.code}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-sm font-semibold ${(v.stock ?? 0) <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                      {(v.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
                                    </span>
                                    <button
                                      onClick={() => openEkstre(mat, v)}
                                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                      title="Stok Ekstresi"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    {canEdit && (
                                      <>
                                        <button
                                          onClick={() => setStokModal({ type: 'variant', id: v.id, materialId: mat.id, name: `${mat.name} — ${v.colorName}`, stock: v.stock ?? 0 })}
                                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                          title="Stok Güncelle"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => openVariantEdit(mat.id, v)}
                                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="Düzenle"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleVariantDelete(mat.id, v.id)}
                                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                          title="Sil"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openVariantAdd(mat.id)}
                              className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" /> Renk / Kod Ekle
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Material Modal */}
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
          <button onClick={() => setHistoryModal(null)} className="w-full mt-2 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
            {t('common', 'close')}
          </button>
        </div>
      </Modal>

      {/* Variant Add/Edit Modal */}
      {variantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVariantModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-purple-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">
                {variantModal.variant ? 'Renk/Kod Düzenle' : 'Renk / Kod Ekle'}
              </h3>
              <button onClick={() => setVariantModal(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Renk Adı *</label>
                <input
                  value={variantForm.colorName}
                  onChange={e => setVariantForm(p => ({ ...p, colorName: e.target.value }))}
                  placeholder="Ör: Siyah, Beyaz, Krem"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kod (opsiyonel)</label>
                <input
                  value={variantForm.code}
                  onChange={e => setVariantForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="Ör: KOD-001"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Başlangıç Stok (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={variantForm.stock}
                  onChange={e => setVariantForm(p => ({ ...p, stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-right"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setVariantModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
                  Vazgeç
                </button>
                <button
                  onClick={handleVariantSave}
                  disabled={variantSaving || !variantForm.colorName.trim()}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {variantSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stok Güncelleme Modalı */}
      {stokModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStokModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-emerald-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">Stok Güncelle</h3>
              <button onClick={() => setStokModal(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">{stokModal.name}</p>
              <div className="text-center">
                <p className="text-xs text-slate-500">Mevcut Stok</p>
                <p className="text-2xl font-bold text-slate-700">
                  {(stokModal.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStokSign(1)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${stokSign === 1 ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  + Stok Ekle
                </button>
                <button
                  onClick={() => setStokSign(-1)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${stokSign === -1 ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  − Stok Azalt
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Miktar (kg)</label>
                <input
                  type="number" step="0.001" min="0"
                  value={stokDelta}
                  onChange={e => setStokDelta(e.target.value)}
                  placeholder="0.000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>
              {stokDelta && (
                <div className="text-center text-sm">
                  <span className="text-slate-500">Yeni stok: </span>
                  <span className="font-bold text-slate-700">
                    {((stokModal.stock ?? 0) + stokSign * (parseFloat(stokDelta) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStokModal(null)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
                  Vazgeç
                </button>
                <button onClick={handleStokSave} disabled={stokSaving || !stokDelta}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {stokSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stok Ekstresi Modal ─────────────────────────────────────────── */}
      {ekstreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEkstreModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-teal-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Stok Ekstresi
                </h3>
                <p className="text-teal-200 text-sm mt-0.5">{ekstreModal.name}</p>
              </div>
              <button onClick={() => setEkstreModal(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {ekstreLoading || !ekstreModal.data ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  {/* Özet kartları */}
                  <div className="grid grid-cols-3 gap-3 p-5 pb-3">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-emerald-600 font-semibold mb-1">Toplam Alış</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {ekstreModal.data.entries
                          .filter((e: any) => e.type === 'alis' || e.type === 'iade')
                          .reduce((s: number, e: any) => s + e.kgAmount, 0)
                          .toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-red-600 font-semibold mb-1">Toplam Satış Tüketimi</p>
                      <p className="text-lg font-bold text-red-700">
                        {Math.abs(ekstreModal.data.entries
                          .filter((e: any) => e.type === 'satis')
                          .reduce((s: number, e: any) => s + e.kgAmount, 0))
                          .toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${(ekstreModal.data.material?.stock ?? 0) < 0 ? 'bg-red-50' : 'bg-teal-50'}`}>
                      <p className="text-xs text-teal-600 font-semibold mb-1">Güncel Stok</p>
                      <p className={`text-lg font-bold ${(ekstreModal.data.material?.stock ?? 0) < 0 ? 'text-red-700' : 'text-teal-700'}`}>
                        {(ekstreModal.data.material?.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
                      </p>
                      {ekstreModal.data.material?.activeVariant && (
                        <p className="text-xs text-teal-500 mt-0.5">{ekstreModal.data.material.activeVariant.colorName}</p>
                      )}
                    </div>
                  </div>

                  {/* Hareketler tablosu */}
                  {ekstreModal.data.entries.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Kayıtlı hareket bulunamadı</div>
                  ) : (
                    <div className="px-5 pb-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                            <th className="px-3 py-2.5 text-left">Tarih</th>
                            <th className="px-3 py-2.5 text-left">İşlem</th>
                            <th className="px-3 py-2.5 text-left">Müşteri / Tedarikçi</th>
                            <th className="px-3 py-2.5 text-left">Ürün</th>
                            <th className="px-3 py-2.5 text-left">Renk</th>
                            <th className="px-3 py-2.5 text-right">Miktar (kg)</th>
                            <th className="px-3 py-2.5 text-right">Fiyat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ekstreModal.data.entries.map((entry: any) => (
                            <tr key={entry.id} className={`hover:bg-slate-50/50 ${
                              entry.type === 'alis' ? 'hover:bg-emerald-50/30' :
                              entry.type === 'iade' ? 'hover:bg-blue-50/30' :
                              'hover:bg-red-50/30'
                            }`}>
                              <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                                {new Date(entry.date).toLocaleDateString('tr-TR')}
                              </td>
                              <td className="px-3 py-2.5">
                                {entry.type === 'alis' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                                    <TrendingUp className="w-3 h-3" /> Alış
                                  </span>
                                ) : entry.type === 'iade' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                    <RotateCcw className="w-3 h-3" /> İade
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                    <TrendingDown className="w-3 h-3" /> Satış
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-700 truncate max-w-[140px]">
                                {entry.party}
                                {entry.invoiceNo && (
                                  <div className="text-xs text-slate-400 font-normal">{entry.invoiceNo}</div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 truncate max-w-[120px]">
                                {entry.product ?? <span className="text-slate-300 italic">—</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                {entry.variant ? (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                    {entry.variant}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-semibold ${entry.kgAmount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {entry.kgAmount > 0 ? '+' : ''}{entry.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 3 })}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-500 text-xs">
                                {entry.pricePerKg
                                  ? `${entry.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${entry.currency ?? ''}/kg`
                                  : <span className="text-slate-300">—</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
