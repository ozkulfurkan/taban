'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import StatCard from '@/app/components/stat-card';
import {
  ArrowLeft, Package, Factory, TrendingUp, Tag, Loader2, X,
  Edit2, Trash2, Layers, TrendingDown, RotateCcw, FileText,
  Plus, CheckCircle, History, AlertTriangle,
} from 'lucide-react';
import { toPriceInput, fromPriceInput, blockDot, normalizePriceInput } from '@/lib/price-input';

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };

function typeBadge(type: string, kgAmount: number) {
  if (type === 'alis') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold"><TrendingUp className="w-3 h-3" /> Alış</span>;
  if (type === 'satis') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold"><TrendingDown className="w-3 h-3" /> Satış</span>;
  if (type === 'iade') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"><RotateCcw className="w-3 h-3" /> İade</span>;
  if (type === 'fason_transfer') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold"><Factory className="w-3 h-3" /> {kgAmount < 0 ? 'Fason Gönderim' : 'Fason İade'}</span>;
  if (type === 'artirma') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold"><TrendingUp className="w-3 h-3" /> Artırma</span>;
  if (type === 'azaltma') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold"><TrendingDown className="w-3 h-3" /> Azaltma</span>;
  if (type === 'stok_guncelleme') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"><Layers className="w-3 h-3" /> Stok Güncelleme</span>;
  return <span className="text-xs text-slate-400">{type}</span>;
}

export default function MaterialDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [material, setMaterial] = useState<any>(null);
  const [ekstre, setEkstre] = useState<any>(null);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ekstreLoading, setEkstreLoading] = useState(true);

  // Stok modal
  const [stokModal, setStokModal] = useState<{
    stock: number;
    subcontractorId?: string;
    subcontractorName?: string;
  } | null>(null);
  const [stokMode, setStokMode] = useState<'artirma' | 'azaltma' | 'stok_guncelleme'>('artirma');
  const [stokValue, setStokValue] = useState('');
  const [stokNotes, setStokNotes] = useState('');
  const [stokSaving, setStokSaving] = useState(false);

  // Fasoncuya gönder modal
  const [sendModal, setSendModal] = useState(false);
  const [sendSubId, setSendSubId] = useState('');
  const [sendQty, setSendQty] = useState('');
  const [sendNotes, setSendNotes] = useState('');
  const [sendSaving, setSendSaving] = useState(false);

  // Fasoncudan al modal
  const [receiveModal, setReceiveModal] = useState<{
    subcontractorId: string; name: string; availableQty: number;
  } | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveSaving, setReceiveSaving] = useState(false);

  // Düzenle modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', category: '', supplier: '', pricePerKg: '', currency: 'USD', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadMaterial = useCallback(async () => {
    const res = await fetch(`/api/materials/${id}`);
    const data = await res.json();
    if (data?.id) setMaterial(data);
  }, [id]);

  const loadEkstre = useCallback(async () => {
    setEkstreLoading(true);
    const res = await fetch(`/api/materials/${id}/ekstre`);
    const data = await res.json();
    setEkstre(data);
    setEkstreLoading(false);
  }, [id]);

  const reload = useCallback(async () => {
    await Promise.all([loadMaterial(), loadEkstre()]);
  }, [loadMaterial, loadEkstre]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadMaterial(),
      loadEkstre(),
      fetch('/api/subcontractors').then(r => r.json()).then(d => { if (Array.isArray(d)) setSubcontractors(d); }),
    ]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (material && editModal) {
      setEditForm({
        name: material.name ?? '',
        category: material.category ?? '',
        supplier: material.supplier ?? '',
        pricePerKg: toPriceInput(material.pricePerKg ?? 0),
        currency: material.currency ?? 'USD',
        description: material.description ?? '',
      });
    }
  }, [editModal, material]);

  const openStokModal = (sub?: { id: string; name: string; qty: number }) => {
    setStokModal(sub
      ? { stock: sub.qty, subcontractorId: sub.id, subcontractorName: sub.name }
      : { stock: material?.stock ?? 0 }
    );
    setStokMode('artirma');
    setStokValue('');
    setStokNotes('');
  };

  const handleStokSave = async () => {
    if (!stokModal || !stokValue) return;
    const num = parseFloat(stokValue.replace(',', '.'));
    if (isNaN(num) || num < 0) return;
    setStokSaving(true);
    try {
      const body: any = { type: stokMode, notes: stokNotes || undefined };
      if (stokModal.subcontractorId) body.subcontractorId = stokModal.subcontractorId;
      if (stokMode === 'stok_guncelleme') body.absoluteValue = num;
      else body.delta = stokMode === 'artirma' ? num : -num;
      await fetch(`/api/materials/${id}/stok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setStokModal(null);
      reload();
    } finally { setStokSaving(false); }
  };

  const handleSendToSub = async () => {
    if (!sendSubId || !sendQty || parseFloat(sendQty) <= 0) return;
    setSendSaving(true);
    try {
      const res = await fetch(`/api/materials/${id}/send-to-subcontractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcontractorId: sendSubId, quantity: parseFloat(sendQty), notes: sendNotes || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setErrorMsg(e.error || 'Hata'); return; }
      setSendModal(false);
      setSendSubId(''); setSendQty(''); setSendNotes('');
      reload();
    } finally { setSendSaving(false); }
  };

  const handleReceiveFromSub = async () => {
    if (!receiveModal || !receiveQty || parseFloat(receiveQty) <= 0) return;
    setReceiveSaving(true);
    try {
      const res = await fetch(`/api/materials/${id}/receive-from-subcontractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcontractorId: receiveModal.subcontractorId, quantity: parseFloat(receiveQty), notes: receiveNotes || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setErrorMsg(e.error || 'Hata'); return; }
      setReceiveModal(null);
      setReceiveQty(''); setReceiveNotes('');
      reload();
    } finally { setReceiveSaving(false); }
  };

  const handleEdit = async () => {
    setEditSaving(true);
    try {
      await fetch(`/api/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, pricePerKg: fromPriceInput(editForm.pricePerKg) }),
      });
      setEditModal(false);
      reload();
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Bu hammaddeyi silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setErrorMsg(d.error || 'Silinemedi'); return; }
    router.push('/materials');
  };

  if (loading) return (
    <AppShell>
      <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
    </AppShell>
  );

  if (!material) return (
    <AppShell>
      <div className="text-center py-20 text-slate-400">Hammadde bulunamadı.</div>
    </AppShell>
  );

  const totalSubStock = (material.subcontractorStocks ?? []).reduce((s: number, ss: any) => s + (ss.quantity ?? 0), 0);
  const stockValue = (material.stock + totalSubStock) * material.pricePerKg;
  const currencySymbol = CURRENCY_SYMBOLS[material.currency] ?? material.currency;

  // Stok modal önizleme
  const stokNum = parseFloat((stokValue || '0').replace(',', '.')) || 0;
  const stokPreview = stokModal
    ? stokMode === 'artirma' ? stokModal.stock + stokNum
      : stokMode === 'azaltma' ? stokModal.stock - stokNum
      : stokNum
    : 0;

  return (
    <AppShell>
      <div className="space-y-5 max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{material.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {material.category && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                    <Tag className="w-3 h-3" />{material.category}
                  </span>
                )}
                {material.supplier && <span className="text-xs text-slate-400">{material.supplier}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Düzenle
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Sil
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Alış Fiyatı" value={material.pricePerKg} suffix={` ${material.currency}/kg`} icon={Tag} color="blue" decimals={2} />
          <StatCard title="Ana Depo Stoku" value={material.stock} suffix=" kg" icon={Package} color="green" decimals={2} />
          <StatCard title="Fasoncudaki Stok" value={totalSubStock} suffix=" kg" icon={Factory} color="orange" decimals={2} />
          <StatCard title="Stok Değeri" value={stockValue} prefix={currencySymbol} icon={TrendingUp} color="purple" decimals={2} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openStokModal()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors">
            <Layers className="w-4 h-4" /> Stok Güncelle (Ana Depo)
          </button>
          {subcontractors.length > 0 && (
            <button onClick={() => { setSendModal(true); setSendSubId(''); setSendQty(''); setSendNotes(''); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors">
              <Factory className="w-4 h-4" /> Fasoncuya Gönder
            </button>
          )}
        </div>

        {/* Two-column */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* LEFT: Ekstre */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-teal-700 px-4 py-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white" />
              <h2 className="text-white font-semibold text-sm">Stok Ekstresi</h2>
            </div>
            {ekstreLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
            ) : !ekstre?.entries?.length ? (
              <div className="text-center py-12 text-slate-400 text-sm">Henüz hareket kaydı yok</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 border-b bg-slate-50">
                      <th className="px-3 py-2.5 text-left">Tarih</th>
                      <th className="px-3 py-2.5 text-left">İşlem</th>
                      <th className="px-3 py-2.5 text-left">Taraf</th>
                      <th className="px-3 py-2.5 text-right">Miktar (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ekstre.entries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(e.date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-3 py-2.5">{typeBadge(e.type, e.kgAmount)}</td>
                        <td className="px-3 py-2.5 text-slate-600 truncate max-w-[120px] text-xs">
                          {e.party}
                          {e.invoiceNo && <div className="text-slate-400">{e.invoiceNo}</div>}
                          {e.product && <div className="text-slate-400">{e.product}</div>}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${e.kgAmount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {e.kgAmount > 0 ? '+' : ''}{e.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-4">

            {/* Subcontractor cards */}
            <div>
              <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                <Factory className="w-4 h-4 text-orange-500" /> Fasoncudaki Stok
              </h2>
              {(material.subcontractorStocks ?? []).filter((ss: any) => ss.quantity > 0).length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center text-sm text-slate-400">
                  Hiçbir fasoncuda stok bulunmuyor
                </div>
              ) : (
                <div className="space-y-3">
                  {(material.subcontractorStocks ?? [])
                    .filter((ss: any) => ss.quantity > 0)
                    .map((ss: any) => {
                      const recentTransfers = (material.materialTransfers ?? [])
                        .filter((t: any) => t.subcontractorId === ss.subcontractorId)
                        .slice(0, 3);
                      return (
                        <div key={ss.id} className="bg-white rounded-xl shadow-sm p-4 border border-orange-100">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-slate-800">{ss.subcontractor?.name}</span>
                            <span className="text-lg font-bold text-orange-600">
                              {ss.quantity.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </span>
                          </div>
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => { setReceiveModal({ subcontractorId: ss.subcontractorId, name: ss.subcontractor?.name, availableQty: ss.quantity }); setReceiveQty(''); setReceiveNotes(''); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors">
                              <Plus className="w-3 h-3" /> Fasoncudan Al
                            </button>
                            <button
                              onClick={() => openStokModal({ id: ss.subcontractorId, name: ss.subcontractor?.name, qty: ss.quantity })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                              <Layers className="w-3 h-3" /> Stok Güncelle
                            </button>
                          </div>
                          {recentTransfers.length > 0 && (
                            <div className="space-y-1 border-t border-slate-100 pt-2">
                              {recentTransfers.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400">{new Date(t.transferDate).toLocaleDateString('tr-TR')}</span>
                                  <span className={`font-medium ${t.direction === 'OUTGOING' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {t.direction === 'OUTGOING' ? '+' : '−'}{t.quantity.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Price history */}
            {(material.priceHistory ?? []).length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-500" /> Fiyat Geçmişi
                </h2>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {(material.priceHistory ?? []).map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleDateString('tr-TR')}</span>
                        <span className="font-semibold text-slate-700 text-sm">
                          {h.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {h.currency}/kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stok Güncelleme Modal ── */}
      {stokModal && (() => {
        const val = parseFloat((stokValue || '0').replace(',', '.')) || 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setStokModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
                <h3 className="text-white font-semibold text-base">
                  {stokModal.subcontractorId ? `Fasoncu Stok Güncelle — ${stokModal.subcontractorName}` : 'Stok Güncelle (Ana Depo)'}
                </h3>
                <button onClick={() => setStokModal(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{material.name}</span>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Mevcut</p>
                    <p className={`text-lg font-bold ${stokModal.stock <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {stokModal.stock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 rounded-xl p-1">
                  {([
                    { key: 'artirma', label: '+ Artır' },
                    { key: 'azaltma', label: '− Azalt' },
                    { key: 'stok_guncelleme', label: '✎ Düzelt' },
                  ] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => { setStokMode(key); setStokValue(''); }}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                        stokMode === key
                          ? key === 'artirma' ? 'bg-emerald-600 text-white shadow-sm'
                            : key === 'azaltma' ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white/70'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {stokMode === 'artirma' ? 'Eklenecek Miktar (kg)' : stokMode === 'azaltma' ? 'Azaltılacak Miktar (kg)' : 'Güncel Stok Değeri (kg)'}
                  </label>
                  <input type="number" step="0.001" min="0" value={stokValue} onChange={e => setStokValue(e.target.value)}
                    placeholder="0,000" autoFocus
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Not (opsiyonel)</label>
                  <input type="text" value={stokNotes} onChange={e => setStokNotes(e.target.value)} placeholder="Açıklama..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                {stokValue && val > 0 && (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-slate-500">Yeni Stok</span>
                    <span className={`text-base font-bold ${stokPreview <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {stokPreview.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </span>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStokModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Vazgeç</button>
                  <button onClick={handleStokSave} disabled={stokSaving || !stokValue || val <= 0}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                    {stokSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <CheckCircle className="w-4 h-4" /> Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Fasoncuya Gönder Modal ── */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSendModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-orange-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base flex items-center gap-2"><Factory className="w-4 h-4" /> Fasoncuya Gönder</h3>
              <button onClick={() => setSendModal(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">{material.name}</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fasoncu *</label>
                <select value={sendSubId} onChange={e => setSendSubId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="">Fasoncu seçin...</option>
                  {subcontractors.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Miktar (kg) *</label>
                <input type="number" step="0.001" min="0.001" value={sendQty} onChange={e => setSendQty(e.target.value)} placeholder="0.000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Not (opsiyonel)</label>
                <input type="text" value={sendNotes} onChange={e => setSendNotes(e.target.value)} placeholder="Açıklama..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setSendModal(false)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Vazgeç</button>
                <button onClick={handleSendToSub} disabled={sendSaving || !sendSubId || !sendQty || parseFloat(sendQty) <= 0}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {sendSaving && <Loader2 className="w-4 h-4 animate-spin" />} Gönder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fasoncudan Al Modal ── */}
      {receiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceiveModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">Fasoncudan Al — {receiveModal.name}</h3>
              <button onClick={() => setReceiveModal(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                <span className="text-xs text-slate-500">Fasoncudaki Stok</span>
                <span className="font-bold text-orange-600">{receiveModal.availableQty.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Alınacak Miktar (kg) *</label>
                <input type="number" step="0.001" min="0.001" max={receiveModal.availableQty} value={receiveQty}
                  onChange={e => setReceiveQty(e.target.value)} placeholder="0.000" autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Not (opsiyonel)</label>
                <input type="text" value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Açıklama..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setReceiveModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Vazgeç</button>
                <button onClick={handleReceiveFromSub} disabled={receiveSaving || !receiveQty || parseFloat(receiveQty) <= 0}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {receiveSaving && <Loader2 className="w-4 h-4 animate-spin" />} Al
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Düzenle Modal ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">Hammadde Düzenle</h3>
              <button onClick={() => setEditModal(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ad *</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kategori</label>
                <input value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="Ör: Taban, Astar" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tedarikçi</label>
                <input value={editForm.supplier} onChange={e => setEditForm(p => ({ ...p, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fiyat/kg</label>
                  <input type="text" inputMode="decimal" value={editForm.pricePerKg}
                    onChange={e => setEditForm(p => ({ ...p, pricePerKg: normalizePriceInput(e.target.value) }))}
                    onKeyDown={blockDot} placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Para Birimi</label>
                  <select value={editForm.currency} onChange={e => setEditForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option>USD</option><option>EUR</option><option>TRY</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Açıklama</label>
                <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditModal(false)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Vazgeç</button>
                <button onClick={handleEdit} disabled={editSaving || !editForm.name}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet
                </button>
              </div>
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
