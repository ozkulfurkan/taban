'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import SizeTable from '@/app/portal/components/size-table';
import Link from 'next/link';
import DecimalInput from '@/app/components/decimal-input';
import BackLink from '@/app/components/back-link';
import { Loader2, Factory, Send, Package, ArrowRight, AlertTriangle, CheckCircle2, Mail, X, RotateCcw, Trash2 } from '@/app/components/icons';
import MoreMenu from '@/app/components/more-menu';

const SHIP_NOTE = 'Ürünler sevk edildi.';
const kg = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretimde', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-brand-100 text-brand-800',
  IN_PRODUCTION: 'bg-brand-100 text-brand-800', IN_PROGRESS: 'bg-brand-100 text-brand-800',
  COMPLETED: 'bg-emerald-100 text-emerald-700', RECEIVED: 'bg-brand-100 text-brand-800',
  CANCELLED: 'bg-ink-100 text-ink-500',
};

export default function SubcontractorOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matList, setMatList] = useState<any[]>([]);

  const [transferForm, setTransferForm] = useState({ materialId: '', quantity: '', notes: '' });
  const [transferSaving, setTransferSaving] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ receivedPairs: '', notes: '' });
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

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
      const res = await fetch(`/api/subcontractor-orders/${params.id}/material-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: transferForm.materialId,
          quantity: parseFloat(String(transferForm.quantity).replace(',', '.')),
          notes: transferForm.notes || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErrorMsg(d.error || 'Hammadde gönderilemedi'); return; }
      if (d.warning) setNotice(d.warning);
      setTransferForm({ materialId: '', quantity: '', notes: '' });
      load();
    } finally { setTransferSaving(false); }
  };

  const handleReceive = async () => {
    setReceiveSaving(true);
    try {
      const res = await fetch(`/api/subcontractor-orders/${params.id}/receive-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedPairs: parseInt(receiveForm.receivedPairs), notes: receiveForm.notes }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErrorMsg(d.error || 'Teslim alınamadı'); return; }
      setReceiveForm({ receivedPairs: '', notes: '' });
      load();
    } finally { setReceiveSaving(false); }
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    try {
      const res = await fetch(`/api/subcontractor-orders/${params.id}/send-email`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); setErrorMsg(d.error); }
      else load();
    } finally { setEmailSending(false); }
  };

  const handleCancel = async () => {
    setConfirmModal({ message: 'Bu siparişi iptal etmek istediğinize emin misiniz?', onConfirm: async () => {
      const res = await fetch(`/api/subcontractor-orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErrorMsg(d.error || 'İptal edilemedi'); }
      load();
    }});
  };

  const handleRestore = async () => {
    const res = await fetch(`/api/subcontractor-orders/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING' }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErrorMsg(d.error || 'Geri alınamadı'); }
    load();
  };

  const handleDelete = async () => {
    setConfirmModal({ message: 'Bu sipariş kalıcı olarak silinecek.', onConfirm: async () => {
      const res = await fetch(`/api/subcontractor-orders/${params.id}`, { method: 'DELETE' });
      if (res.ok) router.replace('/subcontractor-orders');
      else { const d = await res.json(); setErrorMsg(d.error); }
    }});
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div></AppShell>;
  if (!order) return <AppShell><div className="text-center py-16 text-ink-400">Sipariş bulunamadı</div></AppShell>;

  const canReceive = ['IN_PRODUCTION', 'IN_PROGRESS', 'COMPLETED'].includes(order.status);
  const shipped = order.status === 'COMPLETED' && (order.productionUpdates ?? []).some((u: any) => u.notes === SHIP_NOTE);
  const lastDone = (order.productionUpdates ?? []).find((u: any) => u.completedPairs != null)?.completedPairs ?? null;
  const selMat = matList.find((m: any) => m.id === transferForm.materialId);
  const qtyNum = parseFloat(String(transferForm.quantity).replace(',', '.')) || 0;
  const overStock = !!selMat && qtyNum > (selMat.stock ?? 0);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-wrap gap-2 items-center">
          <BackLink href="/subcontractor-orders" label="Fason Siparişleri" />
          <button onClick={handleSendEmail} disabled={emailSending}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {order.emailSentAt ? 'Maili Tekrar Gönder' : 'Mail Gönder'}
          </button>
          <Link href={`/subcontractors/${order.subcontractorId}`} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-ink-200 hover:bg-ink-50 text-ink-700 rounded-lg text-sm font-medium">
            <Factory className="w-4 h-4" /> {order.subcontractor?.name}
          </Link>
          {order.status !== 'CANCELLED' ? (
            order.status !== 'RECEIVED' && (
              <div className="ml-auto">
                <MoreMenu label="Sipariş işlemleri" items={[{ label: 'Siparişi iptal et', icon: X, danger: true, onClick: handleCancel }]} />
              </div>
            )
          ) : (
            <>
              <button onClick={handleRestore}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium ml-auto">
                <RotateCcw className="w-4 h-4" /> Geri Al
              </button>
              <button onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Kalıcı Sil
              </button>
            </>
          )}
        </div>

        {/* Header */}
        <div className="bg-brand-700 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-white font-bold text-lg">{order.orderNo}</p>
            <p className="text-[#F6EDE4]/80 text-sm">{order.product?.name || 'Ürün belirtilmemiş'}</p>
            {order.emailSentAt && <p className="text-[#F6EDE4]/70 text-xs mt-0.5">Mail: {new Date(order.emailSentAt).toLocaleString('tr-TR')}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
            <span className="text-[#F6EDE4]/85 text-sm">{lastDone != null && order.status !== 'RECEIVED' ? `${lastDone.toLocaleString('tr-TR')} / ` : ''}{order.totalPairs.toLocaleString('tr-TR')} çift</span>
            {shipped && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">Fasoncu sevk etti · teslim bekleniyor</span>}
            {order.dueDate && <span className="text-[#F6EDE4]/70 text-xs">Termin: {new Date(order.dueDate).toLocaleDateString('tr-TR')}</span>}
            {order.shippingAddress && <span className="text-[#F6EDE4]/70 text-xs">Sevk: {order.shippingAddress}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Numara Dağılımı */}
            <div className="bg-white rounded-xl shadow-card p-4 border border-ink-200/80">
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-3">Numara Dağılımı</p>
              <div className="hidden sm:block"><SizeTable value={order.sizeDistribution || {}} readOnly /></div>
              <div className="sm:hidden grid grid-cols-3 gap-2">
                {Object.entries(order.sizeDistribution || {}).filter(([, q]) => Number(q) > 0).map(([sz, q]) => (
                  <div key={sz} className="rounded-lg bg-ink-50 text-center py-2">
                    <div className="text-[11px] text-ink-500">{sz}</div>
                    <div className="font-bold text-ink-900">{Number(q).toLocaleString('tr-TR')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* BOM Gereksinimleri */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="px-4 py-2.5 border-b bg-ink-50">
                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide">Hammadde Gereksinimleri</p>
              </div>
              {requirements.length === 0 ? (
                <p className="px-4 py-4 text-ink-400 text-sm">BOM verisi yok</p>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50 border-b text-xs font-semibold text-ink-500">
                        <th className="px-3 py-2 text-left">Parça</th>
                        <th className="px-3 py-2 text-left">Hammadde / Varyant</th>
                        <th className="px-3 py-2 text-right">Gereken (kg)</th>
                        <th className="px-3 py-2 text-right">Bu siparişe gönderilen</th>
                        <th className="px-3 py-2 text-right">Fasoncu zimmeti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {requirements.map((r: any) => {
                        const stockOk  = r.currentSubcontractorStock >= r.kgRequired;
                        const stockLow = r.currentSubcontractorStock > 0 && r.currentSubcontractorStock < r.kgRequired;
                        return (
                          <tr key={r.partId} className={r.deficit > 0 ? 'bg-red-50/20' : ''}>
                            <td className="px-3 py-2.5 font-medium text-ink-700">{r.partName}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-ink-700">{r.materialName}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-ink-800">
                              {kg(r.kgRequired)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-semibold text-ink-700">{kg(r.sentToOrder ?? 0)}</span>
                              {(r.remainingToSend ?? 0) > 0 && <p className="text-xs text-amber-700 mt-0.5">{kg(r.remainingToSend)} gönderilecek</p>}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={`font-semibold ${stockOk ? 'text-emerald-600' : stockLow ? 'text-yellow-600' : 'text-red-500'}`}>
                                {kg(r.currentSubcontractorStock)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="px-4 py-2 text-xs text-ink-400 border-t">* Gereken: fire payı dahil. Zimmet: fasoncudaki toplam miktar (tüm siparişler) · yeşil=yeterli, sarı=kısmen, kırmızı=yetersiz</p>
                </>
              )}
            </div>

            {/* Üretim Geçmişi */}
            {order.productionUpdates?.length > 0 && (
              <div className="bg-white rounded-xl shadow-card p-4 space-y-3 border border-ink-200/80">
                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide">Üretim Takibi</p>
                <div className="space-y-2">
                  {order.productionUpdates.map((u: any) => (
                    <div key={u.id} className="flex gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${STATUS_COLORS[u.status]}`}>{STATUS_LABELS[u.status]}</span>
                        {u.completedPairs != null && <span className="text-ink-600">{u.completedPairs.toLocaleString('tr-TR')} çift</span>}
                        {u.notes && <p className="text-ink-500 text-xs mt-0.5">{u.notes}</p>}
                        <p className="text-ink-400 text-xs">{new Date(u.createdAt).toLocaleString('tr-TR')} — {u.updatedBy}</p>
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
              <div className="bg-white rounded-xl shadow-card p-4 space-y-3 border border-ink-200/80">
                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Hammadde Gönder
                </p>
                <div className="space-y-2">
                  <select value={transferForm.materialId} onChange={e => setTransferForm(p => ({ ...p, materialId: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">— Hammadde Seçin —</option>
                    {matList.map((m: any) => <option key={m.id} value={m.id}>{m.name} (depoda {kg(m.stock ?? 0)} kg)</option>)}
                  </select>
                  <div className="flex gap-2">
                    <DecimalInput min="0" step="0.001" value={transferForm.quantity} onChange={e => setTransferForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="Miktar (kg)" className="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                    <input value={transferForm.notes} onChange={e => setTransferForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Not" className="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  {overStock && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5" data-testid="transfer-stock-warning">
                      Depoda {kg(selMat.stock ?? 0)} kg var; gönderirseniz depo stoğu eksiye düşer.
                    </p>
                  )}
                  <button onClick={handleTransfer} disabled={transferSaving || !transferForm.materialId || !transferForm.quantity}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                    {transferSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Fasoncuya Gönder
                  </button>
                </div>
              </div>
            )}

            {/* Ürün Teslim Al */}
            {canReceive && (
              <div className="bg-white rounded-xl shadow-card p-4 space-y-3 border border-ink-200/80">
                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Ürün Teslim Al
                </p>
                <div className="space-y-2">
                  {lastDone != null && <p className="text-xs text-ink-500">Fasoncunun bildirdiği üretim: <b>{lastDone.toLocaleString('tr-TR')}</b> / {order.totalPairs.toLocaleString('tr-TR')} çift</p>}
                  <DecimalInput min="1" value={receiveForm.receivedPairs} onChange={e => setReceiveForm(p => ({ ...p, receivedPairs: e.target.value }))}
                    placeholder="Teslim alınan çift adedi" className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                  <input value={receiveForm.notes} onChange={e => setReceiveForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Not" className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                  <button onClick={handleReceive} disabled={receiveSaving || !receiveForm.receivedPairs}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                    {receiveSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Teslim Al ve Stoğa Ekle
                  </button>
                </div>
              </div>
            )}

            {/* Hammadde Transfer Geçmişi */}
            {order.materialTransfers?.length > 0 && (
              <div className="bg-white rounded-xl shadow-card p-4 space-y-2 border border-ink-200/80">
                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide">Transfer Geçmişi</p>
                <div className="space-y-1.5">
                  {order.materialTransfers.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-ink-700">{t.material?.name}</span>
                        <span className="text-ink-400 ml-2">{new Date(t.createdAt).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <span className={`font-semibold ${t.direction === 'INCOMING' ? 'text-emerald-700' : 'text-ink-800'}`}>{t.direction === 'INCOMING' ? '−' : ''}{kg(t.quantity)} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fire Kayıtları */}
            {order.scraps?.length > 0 && (
              <div className="bg-white rounded-xl shadow-card p-4 space-y-2 border border-ink-200/80">
                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" /> Fire Kayıtları
                </p>
                {order.scraps.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-ink-600">{s.material?.name} — {s.reason || 'sebep belirtilmemiş'}</span>
                    <span className="font-semibold text-red-600">−{kg(s.quantity)} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-800 mb-1">Emin misiniz?</h3>
                <p className="text-sm text-ink-600 whitespace-pre-line">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-ink-50">İptal</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-pop text-sm text-amber-900 flex items-start gap-3" role="status" data-testid="transfer-warning">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
          <span className="flex-1">Hammadde gönderildi. {notice}</span>
          <button onClick={() => setNotice('')} aria-label="Kapat" className="text-amber-700"><X className="w-4 h-4" /></button>
        </div>
      )}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setErrorMsg('')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-800 mb-1">Hata</h3>
                <p className="text-sm text-ink-600">{errorMsg}</p>
              </div>
            </div>
            <button onClick={() => setErrorMsg('')}
              className="w-full py-2 bg-ink-700 hover:bg-ink-800 text-white rounded-lg text-sm font-medium">
              Tamam
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
