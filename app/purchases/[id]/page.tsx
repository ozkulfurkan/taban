'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import {
  Loader2, Printer, Pencil, X, CreditCard, Building2,
  Save, ChevronLeft, CheckCircle2, Layers, Plus, Trash2, Palette,
} from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR');
const toInput = (d: string | Date | null) => d ? new Date(d).toISOString().split('T')[0] : '';

const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı', 'POS'];

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const [editForm, setEditForm] = useState<any>({});
  const [payForm, setPayForm] = useState({
    amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '',
  });

  // Hammadde girişleri
  const [purchaseMaterials, setPurchaseMaterials] = useState<any[]>([]);
  const [matList, setMatList] = useState<any[]>([]);
  const [newMat, setNewMat] = useState({ materialId: '', materialVariantId: '', kgAmount: '', pricePerKg: '' });
  const [matSaving, setMatSaving] = useState(false);
  const [matDeleting, setMatDeleting] = useState<string | null>(null);

  // Yeni renk ekleme modal
  const [newColorModal, setNewColorModal] = useState(false);
  const [newColorForm, setNewColorForm] = useState({ colorName: '', code: '' });
  const [newColorSaving, setNewColorSaving] = useState(false);

  const loadPurchaseMaterials = useCallback(() => {
    if (!params?.id) return;
    fetch(`/api/purchases/${params.id}/hammaddeler`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPurchaseMaterials(d); });
  }, [params?.id]);

  useEffect(() => {
    fetch('/api/materials?includeVariants=true').then(r => r.json()).then(d => { if (Array.isArray(d)) setMatList(d); });
    loadPurchaseMaterials();
  }, [loadPurchaseMaterials]);

  const handleAddMat = async () => {
    if (!newMat.materialId || !newMat.kgAmount) return;
    setMatSaving(true);
    try {
      await fetch(`/api/purchases/${params.id}/hammaddeler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: newMat.materialId,
          materialVariantId: newMat.materialVariantId || null,
          kgAmount: parseFloat(newMat.kgAmount),
          pricePerKg: newMat.pricePerKg ? parseFloat(newMat.pricePerKg) : null,
        }),
      });
      setNewMat({ materialId: '', materialVariantId: '', kgAmount: '', pricePerKg: '' });
      loadPurchaseMaterials();
    } finally { setMatSaving(false); }
  };

  const handleAddNewColor = async () => {
    if (!newColorForm.colorName.trim() || !newMat.materialId) return;
    setNewColorSaving(true);
    try {
      const res = await fetch(`/api/materials/${newMat.materialId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorName: newColorForm.colorName.trim(), code: newColorForm.code.trim(), stock: 0 }),
      });
      const variant = await res.json();
      // matList'i güncelle
      setMatList(prev => prev.map(m => m.id === newMat.materialId
        ? { ...m, variants: [...(m.variants || []), variant] }
        : m
      ));
      // Yeni eklenen rengi otomatik seç
      setNewMat(p => ({ ...p, materialVariantId: variant.id }));
      setNewColorModal(false);
      setNewColorForm({ colorName: '', code: '' });
    } finally { setNewColorSaving(false); }
  };

  const handleDeleteMat = async (entryId: string) => {
    setMatDeleting(entryId);
    try {
      await fetch(`/api/purchases/${params.id}/hammaddeler`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      loadPurchaseMaterials();
    } finally { setMatDeleting(null); }
  };

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/purchases/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.error) {
          setPurchase(d);
          setEditForm({
            invoiceNo: d.invoiceNo || '',
            date: toInput(d.date),
            currency: d.currency || 'TRY',
            notes: d.notes || '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const updated = await res.json();
      if (!updated?.error) { setPurchase(updated); setEditing(false); }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Bu alış faturası silinecek. Bağlı ödemeler de silinir. Emin misiniz?')) return;
    setDeleting(true);
    await fetch(`/api/purchases/${params.id}`, { method: 'DELETE' });
    router.back();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return;
    setPayLoading(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          amount: payForm.amount,
          currency: purchase.currency,
          date: payForm.date,
          method: payForm.method,
          notes: payForm.notes,
        }),
      });
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '' });
      load();
    } finally { setPayLoading(false); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div></AppShell>;
  if (!purchase) return <AppShell><div className="text-center py-16 text-slate-400">Alış faturası bulunamadı</div></AppShell>;

  const remaining = purchase.total - purchase.paidAmount;

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm">
          <ChevronLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handlePdf(purchase)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Yazdır
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium">
              <Pencil className="w-4 h-4" /> Düzenle
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
              </button>
              <button onClick={() => { setEditing(false); load(); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
                <X className="w-4 h-4" /> Vazgeç
              </button>
            </>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            <X className="w-4 h-4" /> İptal Et
          </button>
          <button onClick={() => setShowPayForm(s => !s)}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
            <CreditCard className="w-4 h-4" /> Ödeme Kaydet
          </button>
          <Link href={`/suppliers/${purchase.supplierId}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 text-white rounded-lg text-sm font-medium">
            <Building2 className="w-4 h-4" /> Tedarikçi Sayfası
          </Link>
        </div>

        {/* Payment form inline */}
        {showPayForm && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
            <form onSubmit={handlePayment} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Tutar</label>
                <input required type="number" step="0.01" value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Kalan: ${fmt(remaining)}`}
                  className="w-36 px-3 py-2 border border-teal-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Yöntem</label>
                <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}
                  className="px-3 py-2 border border-teal-300 rounded-lg text-sm outline-none bg-white">
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">Tarih</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                  className="px-3 py-2 border border-teal-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-teal-700 mb-1">Not</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm outline-none" />
              </div>
              <button type="submit" disabled={payLoading}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Kaydet
              </button>
              <button type="button" onClick={() => setShowPayForm(false)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                İptal
              </button>
            </form>
          </div>
        )}

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Supplier info + Purchase meta */}
          <div className="space-y-3">
            {/* Supplier header */}
            <div className="bg-teal-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{purchase.supplier?.name}</p>
                {purchase.supplier?.taxId && <p className="text-teal-200 text-xs mt-0.5">VKN: {purchase.supplier.taxId}</p>}
              </div>
              <Building2 className="w-5 h-5 text-teal-300" />
            </div>

            {/* Purchase meta card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {editing && (
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">Düzenleme modu aktif</p>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Belge No', field: 'invoiceNo', type: 'text', value: purchase.invoiceNo || '—' },
                  { label: 'Tarihi', field: 'date', type: 'date', value: fmtDate(purchase.date) },
                  { label: 'Para Birimi', field: 'currency', type: 'select', value: purchase.currency },
                ].map(row => (
                  <div key={row.field} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    {editing ? (
                      row.type === 'select' ? (
                        <select value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {['TRY', 'USD', 'EUR'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input type={row.type} value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-teal-400" />
                      )
                    ) : (
                      <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                    )}
                  </div>
                ))}
                {/* Notes */}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Notlar</span>
                  {editing ? (
                    <textarea value={editForm.notes || ''} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-teal-400 resize-none" />
                  ) : (
                    <p className="text-sm text-slate-600">{purchase.notes || <span className="text-slate-300 italic">—</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment history */}
            {purchase.payments?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Ödeme Geçmişi</p>
                <div className="space-y-2">
                  {purchase.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-slate-500">{fmtDate(p.date)} — {p.method}</span>
                      <span className="font-semibold text-teal-600">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-500 pt-2 border-t">
                      <span>Kalan</span>
                      <span>{fmt(remaining)} {purchase.currency}</span>
                    </div>
                  )}
                  {remaining <= 0 && (
                    <div className="text-center text-xs text-teal-600 font-semibold pt-1">Tümü Ödendi ✓</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Totals + Hammadde girişleri */}
          <div className="lg:col-span-2 space-y-3">
            {/* Hammadde Girişleri */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Hammadde Girişleri</h2>
              </div>
              <div className="p-4 space-y-3">
                {/* Yeni giriş formu */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Hammadde</label>
                      <select value={newMat.materialId}
                        onChange={e => setNewMat(p => ({ ...p, materialId: e.target.value, materialVariantId: '' }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                        <option value="">Seç...</option>
                        {matList.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({(m.stock ?? 0).toFixed(2)} kg stok)</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Kg Miktarı</label>
                      <input type="number" step="0.001" min="0" value={newMat.kgAmount}
                        onChange={e => setNewMat(p => ({ ...p, kgAmount: e.target.value }))}
                        placeholder="0.000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Birim Fiyat (opsiyonel)</label>
                      <input type="number" step="0.01" min="0" value={newMat.pricePerKg}
                        onChange={e => setNewMat(p => ({ ...p, pricePerKg: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                    <button onClick={handleAddMat} disabled={matSaving || !newMat.materialId || !newMat.kgAmount}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                      {matSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Ekle
                    </button>
                  </div>

                  {/* Varyant seçimi - sadece seçili hammaddenin varyantı varsa göster */}
                  {newMat.materialId && (() => {
                    const selMat = matList.find(m => m.id === newMat.materialId);
                    const variants = selMat?.variants ?? [];
                    if (variants.length === 0 && !newMat.materialId) return null;
                    return (
                      <div className="flex items-center gap-2 pl-1 pt-1 border-t border-dashed border-slate-200">
                        <Palette className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Renk / Varyant (opsiyonel)</label>
                          <div className="flex gap-2 items-center">
                            <select value={newMat.materialVariantId}
                              onChange={e => setNewMat(p => ({ ...p, materialVariantId: e.target.value }))}
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                              <option value="">— Renk seçiniz (yoksa ana stok) —</option>
                              {variants.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  {v.colorName}{v.code ? ` (${v.code})` : ''} — {(v.stock ?? 0).toFixed(2)} kg stok
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => { setNewColorModal(true); setNewColorForm({ colorName: '', code: '' }); }}
                              className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-medium whitespace-nowrap"
                              title="Listede olmayan rengi ekle"
                            >
                              <Plus className="w-3.5 h-3.5" /> Yeni Renk
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Giriş listesi */}
                {purchaseMaterials.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-sm italic">Henüz hammadde girişi yok</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                        <th className="px-3 py-2 text-left">Hammadde</th>
                        <th className="px-3 py-2 text-left">Renk/Varyant</th>
                        <th className="px-3 py-2 text-right">Kg Miktarı</th>
                        <th className="px-3 py-2 text-right">Birim Fiyat</th>
                        <th className="px-3 py-2 text-right">Mevcut Stok</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseMaterials.map((pm: any) => (
                        <tr key={pm.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-medium text-slate-700">{pm.material?.name}</td>
                          <td className="px-3 py-2.5">
                            {pm.materialVariant ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                                <Palette className="w-3 h-3" />
                                {pm.materialVariant.colorName}{pm.materialVariant.code ? ` (${pm.materialVariant.code})` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs italic">Ana stok</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-600 font-semibold">
                            {pm.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">
                            {pm.pricePerKg ? `${pm.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${pm.material?.currency}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">
                            {pm.materialVariant
                              ? `${(pm.materialVariant.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg`
                              : `${(pm.material?.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg`
                            }
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button onClick={() => handleDeleteMat(pm.id)}
                              disabled={matDeleting === pm.id}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                              {matDeleting === pm.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-teal-600 px-4 py-3">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Alış Özeti</h2>
              </div>

              {/* Amount display */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Toplam Tutar</p>
                    <p className="text-xl font-bold text-slate-800">{fmt(purchase.total)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{purchase.currency}</p>
                  </div>
                  <div className="bg-teal-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Ödenen</p>
                    <p className="text-xl font-bold text-teal-600">{fmt(purchase.paidAmount)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{purchase.currency}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center ${remaining > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-xs text-slate-500 mb-1">Kalan</p>
                    <p className={`text-xl font-bold ${remaining > 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(remaining)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{purchase.currency}</p>
                  </div>
                </div>

                {/* Totals breakdown */}
                <div className="border-t pt-4">
                  <div className="max-w-xs ml-auto space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Fatura Tutarı</span>
                      <span>{fmt(purchase.total)} {purchase.currency}</span>
                    </div>
                    {purchase.paidAmount > 0 && (
                      <div className="flex justify-between text-teal-600">
                        <span>Ödenen</span>
                        <span>- {fmt(purchase.paidAmount)} {purchase.currency}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-bold text-base pt-2 border-t ${remaining > 0 ? 'text-red-500' : 'text-teal-600'}`}>
                      <span>KALAN BORÇ</span>
                      <span>{fmt(remaining)} {purchase.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Supplier contact info */}
                {(purchase.supplier?.phone || purchase.supplier?.email) && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tedarikçi Bilgileri</p>
                    <div className="space-y-1 text-sm">
                      {purchase.supplier?.phone && (
                        <div className="flex gap-2">
                          <span className="text-slate-400 w-16 flex-shrink-0">Telefon</span>
                          <span className="text-slate-700">{purchase.supplier.phone}</span>
                        </div>
                      )}
                      {purchase.supplier?.email && (
                        <div className="flex gap-2">
                          <span className="text-slate-400 w-16 flex-shrink-0">E-posta</span>
                          <span className="text-slate-700">{purchase.supplier.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Yeni Renk / Varyant Ekleme Modal */}
      {newColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNewColorModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" /> Yeni Renk Ekle
              </h3>
              <button onClick={() => setNewColorModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {matList.find(m => m.id === newMat.materialId)?.name}
                </span> için yeni renk/varyant ekle.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Renk Adı *</label>
                <input
                  type="text"
                  value={newColorForm.colorName}
                  onChange={e => setNewColorForm(p => ({ ...p, colorName: e.target.value }))}
                  placeholder="örn: Siyah, Beyaz, #FF0000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kod (opsiyonel)</label>
                <input
                  type="text"
                  value={newColorForm.code}
                  onChange={e => setNewColorForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="örn: BLK-01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddNewColor}
                  disabled={newColorSaving || !newColorForm.colorName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {newColorSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Ekle ve Seç
                </button>
                <button
                  onClick={() => setNewColorModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
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

async function handlePdf(purchase: any) {
  const { default: jsPDF } = await import('jspdf');
  const tr = (s: string) => (s || '').replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');
  const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; let y = M;
  doc.setFillColor(13, 148, 136); doc.rect(0, 0, W, 24, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('ALIS FATURASI', M, 11);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(tr(purchase.invoiceNo || ''), M, 19);
  doc.text(tr(purchase.supplier?.name ?? ''), W - M, 11, { align: 'right' });
  doc.text(new Date(purchase.date).toLocaleDateString('tr-TR'), W - M, 19, { align: 'right' });
  y = 34;
  doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Toplam: ${fmt2(purchase.total)} ${purchase.currency}`, M, y); y += 8;
  doc.text(`Odenen: ${fmt2(purchase.paidAmount)} ${purchase.currency}`, M, y); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Kalan: ${fmt2(purchase.total - purchase.paidAmount)} ${purchase.currency}`, M, y);
  doc.save(`${tr(purchase.invoiceNo || 'alis-faturasi')}.pdf`);
}
