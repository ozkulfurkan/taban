'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import { formatDate, toDateInputValue } from '@/lib/time';
import {
  Loader2, Printer, Pencil, X, CreditCard, Building2,
  Save, ChevronLeft, CheckCircle2, Layers, Plus, Trash2, Palette,
} from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;
const toInput = (d: string | Date | null) => toDateInputValue(d);

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
    amount: '', method: 'Nakit', date: toDateInputValue(), notes: '',
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
    if (!confirm('Bu alış faturası silinecek. Bağlı ödemeler de silinir.\n\n⚠️ Uyarı: Bu alışta eklenen tüm hammadde stokları (kg) geri alınacaktır.\n\nEmin misiniz?')) return;
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
      setPayForm({ amount: '', method: 'Nakit', date: toDateInputValue(), notes: '' });
      load();
    } finally { setPayLoading(false); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div></AppShell>;
  if (!purchase) return <AppShell><div className="text-center py-16 text-slate-400">Alış faturası bulunamadı</div></AppShell>;

  const remaining = purchase.total - purchase.paidAmount;

  const totalKg = purchaseMaterials.reduce((s: number, pm: any) => s + (pm.kgAmount ?? 0), 0);
  const statusLabel = remaining <= 0 ? 'Faturalaşmış' : remaining < purchase.total ? 'Kısmi Ödeme' : 'Beklemede';
  const statusColor = remaining <= 0 ? 'bg-green-100 text-green-700' : remaining < purchase.total ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700';

  return (
    <AppShell>
      <div className="space-y-3 max-w-6xl">

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          <button onClick={() => handlePdf(purchase)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Yazdır
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium">
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
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} İptal Et
          </button>
          <Link href={`/suppliers/${purchase.supplierId}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            <Building2 className="w-4 h-4" /> Tedarikçi Sayfası
          </Link>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">

          {/* LEFT: Supplier info panel */}
          <div className="space-y-3">
            {/* Supplier header */}
            <div className="bg-blue-700 rounded-xl px-4 py-4">
              <p className="text-white font-bold text-base">{purchase.supplier?.name}</p>
              {purchase.supplier?.taxId && <p className="text-blue-200 text-xs mt-0.5">VKN: {purchase.supplier.taxId}</p>}
              {editing && <p className="text-blue-200 text-xs mt-1 italic">Düzenleme modu — alanları değiştirin</p>}
            </div>

            {/* Meta fields */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {/* Belge No */}
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs font-semibold text-slate-400 w-20 flex-shrink-0">Belge No</span>
                  {editing ? (
                    <input value={editForm.invoiceNo || ''} onChange={e => setEditForm((p: any) => ({ ...p, invoiceNo: e.target.value }))}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-teal-400" />
                  ) : (
                    <span className="text-sm text-slate-700 font-medium">{purchase.invoiceNo || <span className="text-slate-300 italic">—</span>}</span>
                  )}
                </div>
                {/* Tarihi */}
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs font-semibold text-slate-400 w-20 flex-shrink-0">Tarihi</span>
                  {editing ? (
                    <input type="date" value={editForm.date || ''} onChange={e => setEditForm((p: any) => ({ ...p, date: e.target.value }))}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-teal-400" />
                  ) : (
                    <span className="text-sm text-slate-700 font-medium">{fmtDate(purchase.date)}</span>
                  )}
                </div>
                {/* Para Birimi */}
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs font-semibold text-slate-400 w-20 flex-shrink-0">Para Bir.</span>
                  {editing ? (
                    <select value={editForm.currency || ''} onChange={e => setEditForm((p: any) => ({ ...p, currency: e.target.value }))}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                      {['TRY', 'USD', 'EUR'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700 font-medium">{purchase.currency}</span>
                  )}
                </div>
                {/* Açıklama/Notlar */}
                <div className="px-4 py-3">
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Açıklama</span>
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
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ödeme Geçmişi</p>
                </div>
                <div className="p-4 space-y-2">
                  {purchase.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-slate-500">{fmtDate(p.date)} — {p.method}</span>
                      <span className="font-semibold text-teal-600">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between text-sm font-bold pt-2 border-t ${remaining > 0 ? 'text-red-500' : 'text-teal-600'}`}>
                    <span>{remaining > 0 ? 'Kalan Borç' : 'Tümü Ödendi ✓'}</span>
                    {remaining > 0 && <span>{fmt(remaining)} {purchase.currency}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Supplier contact */}
            {(purchase.supplier?.phone || purchase.supplier?.email) && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-1 text-sm">
                {purchase.supplier?.phone && (
                  <div className="flex gap-2"><span className="text-slate-400 w-16">Telefon</span><span className="text-slate-700">{purchase.supplier.phone}</span></div>
                )}
                {purchase.supplier?.email && (
                  <div className="flex gap-2"><span className="text-slate-400 w-16">E-posta</span><span className="text-slate-700">{purchase.supplier.email}</span></div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Details */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-green-600 px-5 py-3">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest">Detaylar</h2>
            </div>

            {/* Items table */}
            {purchaseMaterials.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm italic">Henüz hammadde girişi yok</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 bg-slate-50 border-b">
                      <th className="px-4 py-3 text-center w-8">#</th>
                      <th className="px-4 py-3 text-left">Açıklama</th>
                      <th className="px-4 py-3 text-right">Miktar</th>
                      <th className="px-4 py-3 text-right">Fiyat</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                      <th className="px-4 py-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseMaterials.map((pm: any, idx: number) => {
                      const tutar = (pm.kgAmount ?? 0) * (pm.pricePerKg ?? 0);
                      return (
                        <tr key={pm.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-center text-xs text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-700">{pm.material?.name}</p>
                            {pm.materialVariant && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium mt-0.5">
                                <Palette className="w-2.5 h-2.5" />
                                {pm.materialVariant.colorName}{pm.materialVariant.code ? ` (${pm.materialVariant.code})` : ''}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-slate-700">{pm.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg</p>
                            <p className="text-xs text-slate-400">
                              Stok: {pm.materialVariant
                                ? (pm.materialVariant.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : (pm.material?.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {pm.pricePerKg ? pm.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {tutar > 0 ? tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button onClick={() => handleDeleteMat(pm.id)} disabled={matDeleting === pm.id}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                              {matDeleting === pm.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals summary */}
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60">
              <div className="max-w-xs ml-auto space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Toplam Miktar</span>
                  <span className="font-medium">{totalKg.toLocaleString('tr-TR', { minimumFractionDigits: 3 })} kg</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Brüt Toplam</span>
                  <span className="font-medium">{fmt(purchase.total)} {purchase.currency}</span>
                </div>
                <div className="flex justify-between text-teal-600">
                  <span>Ödenen</span>
                  <span className="font-medium">{fmt(purchase.paidAmount)} {purchase.currency}</span>
                </div>
                <div className={`flex justify-between font-bold text-base pt-2 border-t ${remaining > 0 ? 'text-red-500' : 'text-teal-600'}`}>
                  <span>KALAN BORÇ</span>
                  <span>{fmt(remaining)} {purchase.currency}</span>
                </div>
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
  const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
