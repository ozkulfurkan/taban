'use client';

import { ShippedTable } from '@/app/components/shipment-qty';
import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import PortalShell from '../../components/portal-shell';
import OrderStepper from '../../components/order-stepper';
import SizeTable from '../../components/size-table';
import { Loader2, RefreshCw, Truck } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';
import BackLink from '@/app/components/back-link';
import { stageLabel } from '@/lib/order-status';
import { variantLabel, variantText } from '@/lib/shore';

export default function PortalOrderDetailPage() {
  const { tp } = usePortalText();
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>;
  if (!order) return <PortalShell><p className="text-ink-500">{tp('Sipariş bulunamadı.')}</p></PortalShell>;

  const isPackage = Array.isArray(order.orderItems) && order.orderItems.length > 0;

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackLink variant="icon" href="/portal/orders" label="Siparişlerim" />
            <div>
              <h1 className="page-title">{order.orderNo}</h1>
              <p className="text-xs text-ink-400">{new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
          {!isPackage && (
            <button onClick={handleRepeat}
              className="flex items-center gap-1.5 px-3 py-2 bg-ink-100 hover:bg-ink-200 text-ink-600 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className="w-4 h-4" /> {tp('Tekrarla')}
            </button>
          )}
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl p-5 shadow-card overflow-x-auto border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-3">{tp('Sipariş Durumu')}</h2>
          <OrderStepper status={order.status} unit={order.unit} />
          {order.status === 'ORDER_RECEIVED' && (
            <p className={`mt-3 text-sm font-medium ${order.confirmedAt ? 'text-emerald-600' : 'text-amber-600'}`} data-testid="order-confirm-state">
              {tp(stageLabel(order))}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-4">{tp('Sipariş Detayları')}</h2>
          {isPackage ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden">
                <thead className="bg-ink-50">
                  <tr>
                    {['Model', tp(variantLabel(order.unit)), tp('Beden Dağılımı'), tp('Adet')].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-500 border-b border-ink-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {(order.orderItems as any[]).map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5 text-xs font-semibold text-ink-700">
                        {item.productCode && <span className="text-brand-700 mr-1">{item.productCode}</span>}
                        {item.productName}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-600">{variantText({ ...item, unit: item.unit ?? order.unit }) || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(item.sizeDistribution || {})
                            .filter(([, qty]) => (qty as number) > 0)
                            .map(([sz, qty]) => (
                              <span key={sz} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-brand-50 text-brand-800 text-xs rounded font-medium">
                                <span className="text-brand-500">{sz}</span>×<span>{qty as number}</span>
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-ink-800">{formatQty(item.totalQuantity, item.unit ?? order.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                [tp('Model Kodu'), order.productCode || order.product?.name || '—'],
                [tp('Renk'), order.color || '—'],
                [tp('Malzeme'), order.material || '—'],
                ['Toplam Miktar', formatQty(order.totalQuantity, order.unit)],
                ['Termin Tarihi', order.confirmedDeliveryDate
                  ? new Date(order.confirmedDeliveryDate).toLocaleDateString('tr-TR')
                  : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-ink-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-ink-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {order.notes && <p className="mt-4 text-sm text-ink-600 bg-ink-50 rounded-lg p-3">{order.notes}</p>}
        </div>

        {/* Size table */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-3">{isPackage ? tp('Toplam Beden Dağılımı') : tp('Beden Dağılımı')}</h2>
          <SizeTable value={order.sizeDistribution || {}} readOnly />
        </div>

        {/* Shipment */}
        {order.shipment && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-ink-700">{tp('Sevkiyat Bilgileri')}</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                [tp('Sevk Tarihi'), new Date(order.shipment.shipmentDate).toLocaleDateString('tr-TR')],
                [tp('İrsaliye No'), order.shipment.deliveryNoteNo || '—'],
                [tp('Taşıyıcı'), order.shipment.carrier || '—'],
                ['Takip No', order.shipment.trackingNo || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-ink-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-ink-700">{v}</dd>
                </div>
              ))}
            </dl>
            {Array.isArray(order.shipment.items) && (
              <div className="mt-4 pt-3 border-t border-ink-100"><ShippedTable items={order.shipment.items} /></div>
            )}
          </div>
        )}

        {/* Status history */}
        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <h2 className="font-semibold text-ink-700 mb-3">{tp('Durum Geçmişi')}</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-ink-700">{h.status.replace(/_/g, ' ')}</span>
                    {h.note && <span className="text-ink-500 ml-2">— {h.note}</span>}
                    <p className="text-xs text-ink-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
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
