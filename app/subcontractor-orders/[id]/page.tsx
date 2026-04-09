'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import SizeTable from '@/app/portal/components/size-table';
import Link from 'next/link';
import {
  Loader2, ChevronLeft, Factory, Send, Package, ArrowRight,
  AlertTriangle, CheckCircle2, Palette, Mail,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretimde', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700', IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700', RECEIVED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function SubcontractorOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matList, setMatList] = useState<any[]>([]);

  const [transferForm, setTransferForm] = useState({ materialId: '', materialVariantId: '', quantity: '', notes: '' });
  const [transferSaving, setTransferSaving] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ receivedPairs: '', notes: '' });
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/subcontractor-orders/${params.id}`).then(r => r.json()),
      fetch(`/api/subcontractor-orders/${params.id}/material-requirements`).then(r => r.json()),
      fetch('/api/materials?includeVariants=true').then(r => r.json()),
    ]).then(([orderData, reqs, mats]) => {
      if (!orderData?.error) setOrder(orderData);
      if (Array.isArray(reqs)) setRequirements(reqs);
      if (Array.isArray(mats)) setMatList(mats);
    }).finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleTransfer = async () => {
    setTransferSaving(true);
    try {
      await fetch(`/api/subcontractor-orders/${params.id}/material-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: transferForm.materialId,
          materialVariantId: transferForm.materialVariantId || null,
          quantity: parseFloat(transferForm.quantity),
          notes: transferForm.notes || null,
        }),
      });
      setTransferForm({ materialId: '', materialVariantId: '', quantity: '', notes: '' });
      load();
    } finally { setTransferSaving(false); }
  };

  const handleReceive = async () => {
    setReceiveSaving(true);
    try {
      await fetch(`/api/subcontractor-orders/${params.id}/receive-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedPairs: parseInt(receiveForm.receivedPairs), notes: receiveForm.notes }),
      });
      setReceiveForm({ receivedPairs: '', notes: '' });
      load();
    } finally { setReceiveSaving(false); }
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    try {
      const res = await fetch(`/api/subcontractor-orders/${params.id}/send-email`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); alert(d.error); }
      else load();
    } finally { setEmailSending(false); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></AppShell>;
  if (!order) return <AppShell><div className="text-center py-16 text-slate-400">Sipariş bulunamadı</div></AppShell>;

  const canReceive = ['IN_PROGRESS', 'COMPLETED'].includes(order.status);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          <button onClick={handleSendEmail} disabled={emailSending}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {order.emailSentAt ? 'Maili Tekrar Gönder' : 'Mail Gönder'}
          </button>
          <Link href={`/subcontractors/${order.subcontractorId}`} className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium">
            <Factory className="w-4 h-4" /> {order.subcontractor?.name}
          </Link>
        </div>

        {/* Header */}
        <div className="bg-orange-600 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-white font-bold text-lg">{order.orderNo}</p>
            <p className="text-orange-200 text-sm">{order.product?.name || 'Ürün belirtilmemiş'}</p>
            {order.emailSentAt && <p className="text-orange-200 text-xs mt-0.5">Mail: {new Date(order.emailSentAt).toLocaleString('tr-TR')}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
            <span className="text-orange-200 text-sm">{order.totalPairs} çift</span>
            {order.dueDate && <span className="text-orange-200 text-xs">Termin: {new Date(order.dueDate).toLocaleDateString('tr-TR')}</span>}
            {order.shippingAddress && <span className="text-orange-200 text-xs">Sevk: {order.shippingAddress}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Numara Dağılımı */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Numara Dağılımı</p>
              <SizeTable value={order.sizeDistribution || {}} readOnly />
            </div>

            {/* BOM Gereksinimleri */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hammadde Gereksinimleri (BOM)</p>
              </div>
              {requirements.length === 0 ? (
                <p className="px-4 py-4 text-slate-400 text-sm">BOM verisi yok</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b text-xs text-slate-500">
                    <th className="px-3 py-2 text-left">Hammadde</th>
                    <th className="px-3 py-2 text-right">Gereken</th>
                    <th className="px-3 py-2 text-right">Fasonda</th>
                    <th className="px-3 py-2 text-right">Eksik</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {requirements.map((r: any) => (
                      <tr key={r.partId} className={r.deficit > 0 ? 'bg-red-50/30' : ''}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-700">{r.materialName}</p>
                          {r.variantName && <span className="text-xs text-slate-400">{r.variantName}</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 font-medium">{r.kgRequired.toFixed(3)} kg</td>
                        <td className="px-3 py-2 text-right text-slate-600">{r.currentSubcontractorStock.toFixed(3)} kg</td>
                        <td className={`px-3 py-2 text-right font-semibold ${r.deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {r.deficit > 0 ? `−${r.deficit.toFixed(3)} kg` : '✓'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Üretim Geçmişi */}
            {order.productionUpdates?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Üretim Takibi</p>
                <div className="space-y-2">
                  {order.productionUpdates.map((u: any) => (
                    <div key={u.id} className="flex gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${STATUS_COLORS[u.status]}`}>{STATUS_LABELS[u.status]}</span>
                        {u.completedPairs && <span className="text-slate-600">{u.completedPairs} çift</span>}
                        {u.notes && <p className="text-slate-500 text-xs mt-0.5">{u.notes}</p>}
                        <p className="text-slate-400 text-xs">{new Date(u.createdAt).toLocaleString('tr-TR')} — {u.updatedBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column — Actions */}
          <div className="space-y-4">
            {/* Hammadde Gönder */}
            {!['RECEIVED', 'CANCELLED'].includes(order.status) && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Hammadde Gönder
                </p>
                <div className="space-y-2">
                  <select value={transferForm.materialId} onChange={e => setTransferForm(p => ({ ...p, materialId: e.target.value, materialVariantId: '' }))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">— Hammadde Seçin —</option>
                    {matList.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.stock?.toFixed(2) ?? 0} kg)</option>)}
                  </select>
                  {transferForm.materialId && (
                    <select value={transferForm.materialVariantId} onChange={e => setTransferForm(p => ({ ...p, materialVariantId: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">Ana Stok</option>
                      {(matList.find(m => m.id === transferForm.materialId)?.variants ?? []).map((v: any) => (
                        <option key={v.id} value={v.id}>{v.colorName}{v.code ? ` (${v.code})` : ''}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.001" value={transferForm.quantity} onChange={e => setTransferForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="Miktar (kg)" className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                    <input value={transferForm.notes} onChange={e => setTransferForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Not" className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <button onClick={handleTransfer} disabled={transferSaving || !transferForm.materialId || !transferForm.quantity}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                    {transferSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Fasoncuya Gönder
                  </button>
                </div>
              </div>
            )}

            {/* Ürün Teslim Al */}
            {canReceive && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Ürün Teslim Al
                </p>
                <div className="space-y-2">
                  <input type="number" min="1" value={receiveForm.receivedPairs} onChange={e => setReceiveForm(p => ({ ...p, receivedPairs: e.target.value }))}
                    placeholder="Teslim alınan çift adedi" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
                  <input value={receiveForm.notes} onChange={e => setReceiveForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Not" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
                  <button onClick={handleReceive} disabled={receiveSaving || !receiveForm.receivedPairs}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                    {receiveSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Teslim Al ve Stoğa Ekle
                  </button>
                </div>
              </div>
            )}

            {/* Hammadde Transfer Geçmişi */}
            {order.materialTransfers?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Transfer Geçmişi</p>
                <div className="space-y-1.5">
                  {order.materialTransfers.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-slate-700">{t.material?.name}</span>
                        {t.materialVariant && <span className="text-slate-400 ml-1"><Palette className="w-2.5 h-2.5 inline" /> {t.materialVariant.colorName}</span>}
                        <span className="text-slate-400 ml-2">{new Date(t.createdAt).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <span className="font-semibold text-orange-600">{t.quantity.toFixed(3)} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fire Kayıtları */}
            {order.scraps?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" /> Fire Kayıtları
                </p>
                {order.scraps.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{s.material?.name} — {s.reason || 'sebep belirtilmemiş'}</span>
                    <span className="font-semibold text-red-600">−{s.quantity.toFixed(3)} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
