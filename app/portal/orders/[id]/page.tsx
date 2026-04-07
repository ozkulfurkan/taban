'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import PortalShell from '../../components/portal-shell';
import OrderStepper from '../../components/order-stepper';
import SizeTable from '../../components/size-table';
import { ArrowLeft, Loader2, RefreshCw, Truck } from 'lucide-react';

export default function PortalOrderDetailPage() {
  const { status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated' || !params?.id) return;
    fetch(`/api/portal/me/orders/${params.id}`)
      .then(r => r.json()).then(d => setOrder(d.error ? null : d))
      .finally(() => setLoading(false));
  }, [status, router, params?.id]);

  const handleRepeat = () => {
    if (!order) return;
    const p = new URLSearchParams({
      productId: order.productId || '',
      productCode: order.productCode || '',
      color: order.color || '',
      material: order.material || '',
      sizeDistribution: JSON.stringify(order.sizeDistribution || {}),
    });
    router.push(`/portal/orders/new?${p.toString()}`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!order) return <PortalShell><p className="text-slate-500">Sipariş bulunamadı.</p></PortalShell>;

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{order.orderNo}</h1>
              <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
          <button onClick={handleRepeat}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Tekrarla
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl p-5 shadow-sm overflow-x-auto">
          <h2 className="font-semibold text-slate-700 mb-3">Sipariş Durumu</h2>
          <OrderStepper status={order.status} />
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Sipariş Detayları</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Model Kodu', order.productCode || order.product?.name || '—'],
              ['Renk', order.color || '—'],
              ['Malzeme', order.material || '—'],
              ['Toplam Adet', order.totalQuantity],
              ['İstenen Termin', order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString('tr-TR') : '—'],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-xs text-slate-400 mb-0.5">{k}</dt>
                <dd className="font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
          {order.notes && <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{order.notes}</p>}
        </div>

        {/* Size table */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-3">Beden Dağılımı</h2>
          <SizeTable value={order.sizeDistribution || {}} readOnly />
        </div>

        {/* Shipment */}
        {order.shipment && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-slate-700">Sevkiyat Bilgileri</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Sevk Tarihi', new Date(order.shipment.shipmentDate).toLocaleDateString('tr-TR')],
                ['İrsaliye No', order.shipment.deliveryNoteNo || '—'],
                ['Taşıyıcı', order.shipment.carrier || '—'],
                ['Takip No', order.shipment.trackingNo || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-slate-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Status history */}
        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-3">Durum Geçmişi</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700">{h.status.replace(/_/g, ' ')}</span>
                    {h.note && <span className="text-slate-500 ml-2">— {h.note}</span>}
                    <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
