'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock, Package, Flame, Truck, MapPin } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretime Başlandı', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700', IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700', RECEIVED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
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
  const [scrapVariantId, setScrapVariantId] = useState('');
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
        materialVariantId: scrapVariantId || undefined,
        quantity: parseFloat(scrapQty),
        reason: scrapReason || undefined,
      }),
    });
    setScrapLoading(false);
    if (res.ok) {
      setScrapMsg('Fire kaydedildi.');
      setScrapQty(''); setScrapReason(''); setScrapVariantId('');
      loadOrder();
    } else {
      const d = await res.json();
      setScrapMsg(d.error || 'Hata oluştu.');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  if (!order) return <div className="text-center py-16 text-slate-400">Sipariş bulunamadı.</div>;

  const currentStepIdx = STEPS.indexOf(order.status);
  const nextStatuses = ALLOWED_TRANSITIONS[order.status] || [];
  const sizeRows = Object.entries(order.sizeDistribution as Record<string, number>).filter(([, v]) => v > 0);

  // Map stocks by materialId for scrap form
  const stockByMaterial: Record<string, any> = {};
  for (const s of stocks) {
    const key = s.materialVariantId ? `${s.materialId}_${s.materialVariantId}` : s.materialId;
    stockByMaterial[key] = s;
  }
  const uniqueMaterials = stocks.reduce((acc: any[], s) => {
    if (!acc.find(a => a.materialId === s.materialId)) acc.push(s);
    return acc;
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/portal/fason/orders" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{order.orderNo}</h1>
          <p className="text-slate-500 text-sm">{order.product?.name || '—'} · {order.totalPairs} çift</p>
        </div>
      </div>

      {/* Sevk Et Banner */}
      {order.status === 'COMPLETED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Truck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Üretim Tamamlandı — Sevk Edilmeyi Bekliyor</p>
              {order.shippingAddress ? (
                <p className="text-sm text-green-700 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {order.shippingAddress}
                </p>
              ) : (
                <p className="text-sm text-green-600 mt-0.5">Sevk adresi belirtilmemiş. Yetkilinizle iletişime geçin.</p>
              )}
            </div>
          </div>
          {shipDone ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Sevk Bildirildi
            </span>
          ) : (
            <button onClick={handleShip} disabled={shipLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors flex-shrink-0">
              {shipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Sevk Edildi Olarak İşaretle
            </button>
          )}
        </div>
      )}

      {/* Status stepper */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Sipariş Durumu</h2>
        <div className="flex items-center gap-1 flex-wrap">
          {STEPS.filter(s => s !== 'CANCELLED').map((step, idx) => {
            const done = STEPS.indexOf(order.status) > idx || order.status === step;
            const active = order.status === step;
            return (
              <div key={step} className="flex items-center gap-1">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${active ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {done && !active ? <CheckCircle2 className="w-3 h-3" /> : null}
                  {STATUS_LABELS[step]}
                </div>
                {idx < STEPS.filter(s => s !== 'CANCELLED').length - 1 && (
                  <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {nextStatuses.length > 0 && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500">Durumu güncelle:</span>
            {nextStatuses.map(ns => (
              <button key={ns} onClick={() => handleStatusUpdate(ns)} disabled={statusLoading}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                {statusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {STATUS_LABELS[ns]}
              </button>
            ))}
          </div>
        )}
        {statusMsg && (
          <p className={`mt-2 text-xs ${statusMsg.includes('güncellendi') ? 'text-green-600' : 'text-red-500'}`}>{statusMsg}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Order info */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Sipariş Bilgileri</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Sipariş No</span>
              <span className="font-medium text-slate-800">{order.orderNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ürün</span>
              <span className="font-medium text-slate-800">{order.product?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Toplam Çift</span>
              <span className="font-medium text-slate-800">{order.totalPairs}</span>
            </div>
            {order.dueDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Termin</span>
                <span className={`font-medium ${new Date(order.dueDate) < new Date() && !['RECEIVED', 'CANCELLED'].includes(order.status) ? 'text-red-600' : 'text-slate-800'}`}>
                  {new Date(order.dueDate).toLocaleDateString('tr-TR')}
                </span>
              </div>
            )}
            {order.shippingAddress && (
              <div className="flex justify-between">
                <span className="text-slate-500">Sevk Adresi</span>
                <span className="font-medium text-slate-800 text-right max-w-[60%]">{order.shippingAddress}</span>
              </div>
            )}
            {order.notes && (
              <div className="pt-2 border-t">
                <p className="text-slate-500 text-xs mb-1">Notlar</p>
                <p className="text-slate-700 text-sm">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Size distribution */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Numara Dağılımı</h2>
          {sizeRows.length === 0 ? (
            <p className="text-slate-400 text-sm">Numara dağılımı yok.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sizeRows.map(([size, qty]) => (
                <div key={size} className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">{size}</p>
                  <p className="font-bold text-slate-800">{qty}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hammadde / BOM */}
      {order.product?.parts?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" /> Hammadde Gereksinimleri
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {order.product.parts.map((part: any) => {
              const kgRequired = (part.gramsPerPiece * (1 + part.wasteRate / 100) * order.totalPairs) / 1000;
              const stock = stocks.find(s => s.materialId === part.materialId && !s.materialVariantId);
              const variantStock = part.materialVariantId ? stocks.find(s => s.materialVariantId === part.materialVariantId) : null;
              const available = (variantStock ?? stock)?.quantity ?? 0;
              const deficit = kgRequired - available;
              return (
                <div key={part.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{part.name}</p>
                    <p className="text-xs text-slate-400">{part.material?.name}{part.materialVariant ? ` · ${part.materialVariant.colorName}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">{kgRequired.toFixed(2)} kg gerekli</p>
                    <p className={`text-xs ${deficit > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {deficit > 0 ? `${deficit.toFixed(2)} kg eksik` : `${available.toFixed(2)} kg mevcut`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transfers received */}
      {order.materialTransfers?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-slate-700 text-sm">Gelen Hammaddeler</p>
          </div>
          <div className="divide-y divide-slate-100">
            {order.materialTransfers.map((t: any) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700">{t.material?.name}{t.materialVariant ? ` · ${t.materialVariant.colorName}` : ''}</p>
                  <p className="text-xs text-slate-400">{new Date(t.transferDate).toLocaleDateString('tr-TR')}</p>
                </div>
                <p className="text-sm font-medium text-blue-700">{t.quantity} kg</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrap report */}
      {!['RECEIVED', 'CANCELLED', 'PENDING'].includes(order.status) && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" /> Fire Bildir
            </h2>
            <button onClick={() => setScrapOpen(p => !p)}
              className="text-xs text-orange-600 hover:underline font-medium">
              {scrapOpen ? 'Kapat' : 'Bildir'}
            </button>
          </div>
          {scrapOpen && (
            <form onSubmit={handleScrap} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hammadde</label>
                <select value={scrapMaterialId} onChange={e => setScrapMaterialId(e.target.value)} required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="">Seçin...</option>
                  {uniqueMaterials.map(s => (
                    <option key={s.materialId} value={s.materialId}>{s.material?.name}</option>
                  ))}
                </select>
              </div>
              {scrapMaterialId && stocks.filter(s => s.materialId === scrapMaterialId && s.materialVariantId).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Renk/Varyant</label>
                  <select value={scrapVariantId} onChange={e => setScrapVariantId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="">Tümü</option>
                    {stocks.filter(s => s.materialId === scrapMaterialId && s.materialVariantId).map(s => (
                      <option key={s.materialVariantId} value={s.materialVariantId}>{s.materialVariant?.colorName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Miktar (kg)</label>
                <input type="number" step="0.01" min="0.01" value={scrapQty} onChange={e => setScrapQty(e.target.value)} required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sebep (opsiyonel)</label>
                <input type="text" value={scrapReason} onChange={e => setScrapReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Fire nedeni..." />
              </div>
              <button type="submit" disabled={scrapLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                {scrapLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Fire Kaydet
              </button>
              {scrapMsg && (
                <p className={`text-xs ${scrapMsg.includes('kaydedildi') ? 'text-green-600' : 'text-red-500'}`}>{scrapMsg}</p>
              )}
            </form>
          )}

          {/* Existing scrap records */}
          {order.scraps?.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Kayıtlı Fireler</p>
              <div className="space-y-2">
                {order.scraps.map((sc: any) => (
                  <div key={sc.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-slate-700">{sc.material?.name}</span>
                      {sc.reason && <span className="text-xs text-slate-400 ml-2">· {sc.reason}</span>}
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
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Üretim Geçmişi
          </h2>
          <div className="space-y-3">
            {[...order.productionUpdates].reverse().map((u: any) => (
              <div key={u.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{STATUS_LABELS[u.status]}</p>
                  {u.completedPairs != null && (
                    <p className="text-xs text-slate-500">{u.completedPairs} çift tamamlandı</p>
                  )}
                  {u.notes && <p className="text-xs text-slate-400">{u.notes}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(u.createdAt).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
