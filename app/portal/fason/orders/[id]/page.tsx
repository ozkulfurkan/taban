'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock, Package, Flame, Truck, MapPin } from '@/app/components/icons';
import DecimalInput from '@/app/components/decimal-input';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretime Başlandı', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-brand-100 text-brand-800',
  IN_PRODUCTION: 'bg-brand-100 text-brand-800', IN_PROGRESS: 'bg-brand-100 text-brand-800',
  COMPLETED: 'bg-emerald-100 text-emerald-700', RECEIVED: 'bg-brand-100 text-brand-800',
  CANCELLED: 'bg-ink-100 text-ink-500',
};
const STEPS = ['PENDING', 'MATERIAL_SENT', 'IN_PRODUCTION', 'IN_PROGRESS', 'COMPLETED', 'RECEIVED'];
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  MATERIAL_SENT: ['IN_PRODUCTION'],
  IN_PRODUCTION: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
};

export default function FasonOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sevk Et
  const [shipLoading, setShipLoading] = useState(false);
  const [shipDone, setShipDone] = useState(false);

  // Status update
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Scrap form
  const [scrapOpen, setScrapOpen] = useState(false);
  const [scrapMaterialId, setScrapMaterialId] = useState('');
  const [scrapQty, setScrapQty] = useState('');
  const [scrapReason, setScrapReason] = useState('');
  const [scrapLoading, setScrapLoading] = useState(false);
  const [scrapMsg, setScrapMsg] = useState('');

  const loadOrder = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/fason/orders/${id}`).then(r => r.json()),
      fetch('/api/portal/fason/stock').then(r => r.json()),
    ]).then(([o, s]) => {
      if (o?.id) setOrder(o);
      if (Array.isArray(s)) setStocks(s);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { if (id) loadOrder(); }, [id]);

  const handleShip = async () => {
    setShipLoading(true);
    const res = await fetch(`/api/portal/fason/orders/${id}/ship`, { method: 'POST' });
    setShipLoading(false);
    if (res.ok) { setShipDone(true); loadOrder(); }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setStatusLoading(true);
    setStatusMsg('');
    const res = await fetch(`/api/portal/fason/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusLoading(false);
    if (res.ok) {
      setStatusMsg('Durum güncellendi.');
      loadOrder();
    } else {
      const d = await res.json();
      setStatusMsg(d.error || 'Hata oluştu.');
    }
  };

  const handleScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrapLoading(true);
    setScrapMsg('');
    const res = await fetch(`/api/portal/fason/orders/${id}/scrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialId: scrapMaterialId,
        quantity: parseFloat(scrapQty),
        reason: scrapReason || undefined,
      }),
    });
    setScrapLoading(false);
    if (res.ok) {
      setScrapMsg('Fire kaydedildi.');
      setScrapQty(''); setScrapReason('');
      loadOrder();
    } else {
      const d = await res.json();
      setScrapMsg(d.error || 'Hata oluştu.');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;
  if (!order) return <div className="text-center py-16 text-ink-400">Sipariş bulunamadı.</div>;

  const currentStepIdx = STEPS.indexOf(order.status);
  const nextStatuses = ALLOWED_TRANSITIONS[order.status] || [];
  const sizeRows = Object.entries(order.sizeDistribution as Record<string, number>).filter(([, v]) => v > 0);

  // Map stocks by materialId for scrap form
  const stockByMaterial: Record<string, any> = {};
  for (const s of stocks) {
    stockByMaterial[s.materialId] = s;
  }
  const uniqueMaterials = stocks;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/portal/fason/orders" className="p-1.5 hover:bg-ink-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-ink-600" />
        </Link>
        <div>
          <h1 className="page-title">{order.orderNo}</h1>
          <p className="text-ink-500 text-sm">{order.product?.name || '—'} · {order.totalPairs} çift</p>
        </div>
      </div>

      {/* Sevk Et Banner */}
      {order.status === 'COMPLETED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Truck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-800">Üretim Tamamlandı — Sevk Edilmeyi Bekliyor</p>
              {order.shippingAddress ? (
                <p className="text-sm text-emerald-700 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {order.shippingAddress}
                </p>
              ) : (
                <p className="text-sm text-emerald-600 mt-0.5">Sevk adresi belirtilmemiş. Yetkilinizle iletişime geçin.</p>
              )}
            </div>
          </div>
          {shipDone ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Sevk Bildirildi
            </span>
          ) : (
            <button onClick={handleShip} disabled={shipLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors flex-shrink-0">
              {shipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Sevk Edildi Olarak İşaretle
            </button>
          )}
        </div>
      )}

      {/* Status stepper */}
      <div className="bg-white rounded-xl shadow-card p-4 border border-ink-200/80">
        <h2 className="text-sm font-semibold text-ink-700 mb-3">Sipariş Durumu</h2>
        <div className="flex items-center gap-1 flex-wrap">
          {STEPS.filter(s => s !== 'CANCELLED').map((step, idx) => {
            const done = STEPS.indexOf(order.status) > idx || order.status === step;
            const active = order.status === step;
            return (
              <div key={step} className="flex items-center gap-1">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${active ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-400'}`}>
                  {done && !active ? <CheckCircle2 className="w-3 h-3" /> : null}
                  {STATUS_LABELS[step]}
                </div>
                {idx < STEPS.filter(s => s !== 'CANCELLED').length - 1 && (
                  <ChevronRight className="w-3 h-3 text-ink-300 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {nextStatuses.length > 0 && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-ink-500">Durumu güncelle:</span>
            {nextStatuses.map(ns => (
              <button key={ns} onClick={() => handleStatusUpdate(ns)} disabled={statusLoading}
                className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                {statusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {STATUS_LABELS[ns]}
              </button>
            ))}
          </div>
        )}
        {statusMsg && (
          <p className={`mt-2 text-xs ${statusMsg.includes('güncellendi') ? 'text-emerald-600' : 'text-red-500'}`}>{statusMsg}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Order info */}
        <div className="bg-white rounded-xl shadow-card p-4 space-y-3 border border-ink-200/80">
          <h2 className="text-sm font-semibold text-ink-700">Sipariş Bilgileri</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Sipariş No</span>
              <span className="font-medium text-ink-800">{order.orderNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Ürün</span>
              <span className="font-medium text-ink-800">{order.product?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Toplam Çift</span>
              <span className="font-medium text-ink-800">{order.totalPairs}</span>
            </div>
            {order.dueDate && (
              <div className="flex justify-between">
                <span className="text-ink-500">Termin</span>
                <span className={`font-medium ${new Date(order.dueDate) < new Date() && !['RECEIVED', 'CANCELLED'].includes(order.status) ? 'text-red-600' : 'text-ink-800'}`}>
                  {new Date(order.dueDate).toLocaleDateString('tr-TR')}
                </span>
              </div>
            )}
            {order.shippingAddress && (
              <div className="flex justify-between">
                <span className="text-ink-500">Sevk Adresi</span>
                <span className="font-medium text-ink-800 text-right max-w-[60%]">{order.shippingAddress}</span>
              </div>
            )}
            {order.notes && (
              <div className="pt-2 border-t">
                <p className="text-ink-500 text-xs mb-1">Notlar</p>
                <p className="text-ink-700 text-sm">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Size distribution */}
        <div className="bg-white rounded-xl shadow-card p-4 border border-ink-200/80">
          <h2 className="text-sm font-semibold text-ink-700 mb-3">Numara Dağılımı</h2>
          {sizeRows.length === 0 ? (
            <p className="text-ink-400 text-sm">Numara dağılımı yok.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sizeRows.map(([size, qty]) => (
                <div key={size} className="bg-ink-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-ink-500">{size}</p>
                  <p className="font-bold text-ink-800">{qty}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hammadde / BOM */}
      {order.product?.parts?.length > 0 && (
        <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-ink-700 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" /> Hammadde Gereksinimleri
            </p>
          </div>
          <div className="divide-y divide-ink-100">
            {order.product.parts.map((part: any) => {
              const kgRequired = (part.gramsPerPiece * (1 + part.wasteRate / 100) * order.totalPairs) / 1000;
              const matStock = stocks.find((s: any) => s.materialId === part.materialId);
              const available = matStock?.quantity ?? 0;
              const deficit = kgRequired - available;
              const stockOk  = available >= kgRequired;
              const stockLow = available > 0 && available < kgRequired;
              return (
                <div key={part.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-700">{part.name}</p>
                    <p className="text-xs text-ink-500">{part.material?.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-amber-600">{kgRequired.toFixed(3)} kg gerekli</p>
                    <p className={`text-xs font-medium ${stockOk ? 'text-emerald-600' : stockLow ? 'text-yellow-600' : 'text-red-500'}`}>
                      {available.toFixed(3)} kg mevcut
                    </p>
                    {deficit > 0 && (
                      <p className="text-xs text-red-400">−{deficit.toFixed(3)} eksik</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transfers received */}
      {order.materialTransfers?.length > 0 && (
        <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-ink-700 text-sm">Gelen Hammaddeler</p>
          </div>
          <div className="divide-y divide-ink-100">
            {order.materialTransfers.map((t: any) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-700">{t.material?.name}</p>
                  <p className="text-xs text-ink-400">{new Date(t.transferDate).toLocaleDateString('tr-TR')}</p>
                </div>
                <p className="text-sm font-medium text-brand-800">{t.quantity} kg</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrap report */}
      {!['RECEIVED', 'CANCELLED', 'PENDING'].includes(order.status) && (
        <div className="bg-white rounded-xl shadow-card p-4 border border-ink-200/80">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700 flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" /> Fire Bildir
            </h2>
            <button onClick={() => setScrapOpen(p => !p)}
              className="text-xs text-amber-600 hover:underline font-medium">
              {scrapOpen ? 'Kapat' : 'Bildir'}
            </button>
          </div>
          {scrapOpen && (
            <form onSubmit={handleScrap} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Hammadde</label>
                <select value={scrapMaterialId} onChange={e => setScrapMaterialId(e.target.value)} required
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none">
                  <option value="">Seçin...</option>
                  {uniqueMaterials.map(s => (
                    <option key={s.materialId} value={s.materialId}>{s.material?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Miktar (kg)</label>
                <DecimalInput step="0.01" min="0.01" value={scrapQty} onChange={e => setScrapQty(e.target.value)} required
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Sebep (opsiyonel)</label>
                <input type="text" value={scrapReason} onChange={e => setScrapReason(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="Fire nedeni..." />
              </div>
              <button type="submit" disabled={scrapLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                {scrapLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Fire Kaydet
              </button>
              {scrapMsg && (
                <p className={`text-xs ${scrapMsg.includes('kaydedildi') ? 'text-emerald-600' : 'text-red-500'}`}>{scrapMsg}</p>
              )}
            </form>
          )}

          {/* Existing scrap records */}
          {order.scraps?.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium text-ink-500 mb-2">Kayıtlı Fireler</p>
              <div className="space-y-2">
                {order.scraps.map((sc: any) => (
                  <div key={sc.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-ink-700">{sc.material?.name}</span>
                      {sc.reason && <span className="text-xs text-ink-400 ml-2">· {sc.reason}</span>}
                    </div>
                    <span className="font-medium text-red-600">{sc.quantity} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Production timeline */}
      {order.productionUpdates?.length > 0 && (
        <div className="bg-white rounded-xl shadow-card p-4 border border-ink-200/80">
          <h2 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-ink-400" /> Üretim Geçmişi
          </h2>
          <div className="space-y-3">
            {[...order.productionUpdates].reverse().map((u: any) => (
              <div key={u.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-ink-700">{STATUS_LABELS[u.status]}</p>
                  {u.completedPairs != null && (
                    <p className="text-xs text-ink-500">{u.completedPairs} çift tamamlandı</p>
                  )}
                  {u.notes && <p className="text-xs text-ink-400">{u.notes}</p>}
                  <p className="text-xs text-ink-400 mt-0.5">{new Date(u.createdAt).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
