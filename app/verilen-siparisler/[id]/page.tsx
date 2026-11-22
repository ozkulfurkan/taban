'use client';

import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Truck } from '@/app/components/icons';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import OrderStepper from '@/app/portal/components/order-stepper';
import { stageLabel, statusLabel } from '@/lib/order-status';
import { isPairUnit } from '@/lib/order-units';
import { ShippedTable } from '@/app/components/shipment-qty';
import { variantLabel, variantText } from '@/lib/shore';

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');
const sizes = (d: Record<string, number> = {}) => Object.entries(d)
  .filter(([, q]) => Number(q) > 0)
  .sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }));

// Bağlı tedarikçiye verilen siparişin durumu, kalemleri ve sevkiyatı
export default function NetworkOrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<any>(undefined);

  useEffect(() => {
    fetch(`/api/network/orders/${params?.id}`).then(r => (r.ok ? r.json() : null)).then(setOrder).catch(() => setOrder(null));
  }, [params?.id]);

  if (order === undefined) return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div></AppShell>;
  if (!order) return <AppShell><div className="text-center py-12 text-ink-400">Sipariş bulunamadı</div></AppShell>;

  const items: any[] = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : [{ productCode: order.productCode, productName: '', color: order.color, sizeDistribution: order.sizeDistribution, totalQuantity: order.totalQuantity }];

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">
        <BackLink href="/verilen-siparisler" label="Verilen Siparişler" />
        <div>
          <h1 className="page-title" data-testid="network-order-no">{order.orderNo}</h1>
          <p className="text-sm text-ink-500">{order.link?.sellerCompany?.name} · {fmt(order.createdAt)} · {formatQty(order.totalQuantity, order.unit)}</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-card overflow-x-auto border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-3">Sipariş Durumu</h2>
          <OrderStepper status={order.status} unit={order.unit} />
          {order.status === 'ORDER_RECEIVED' && (
            <p className={`mt-3 text-sm font-medium ${order.confirmedAt ? 'text-emerald-600' : 'text-amber-600'}`} data-testid="order-confirm-state">
              {stageLabel(order)}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-3">Kalemler</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-400 uppercase">
              <th className="py-2">Ürün</th><th>{variantLabel(order.unit)}</th>{isPairUnit(order.unit) && <th>Beden dağılımı</th>}<th className="text-right">Miktar</th>
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2.5 font-semibold text-ink-700">{[it.productCode, it.productName].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="text-ink-600">{variantText({ ...it, unit: (it as any).unit ?? order.unit }) || '—'}</td>
                  {isPairUnit(order.unit) && <td>
                    <div className="flex flex-wrap gap-1">
                      {sizes(it.sizeDistribution).map(([sz, q]) => (
                        <span key={sz} className="px-1.5 py-0.5 bg-brand-50 text-brand-800 text-xs rounded font-medium"><span className="text-brand-500">{sz}</span>×{q}</span>
                      ))}
                    </div>
                  </td>}
                  <td className="text-right font-bold text-ink-800">{formatQty(it.totalQuantity, it.unit ?? order.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-2 gap-3 text-sm mt-4">
            <div><dt className="text-xs text-ink-400">İstenen termin</dt><dd className="font-medium text-ink-700">{fmt(order.requestedDeliveryDate)}</dd></div>
            <div><dt className="text-xs text-ink-400">Onaylanan termin</dt><dd className="font-medium text-ink-700">{fmt(order.confirmedDeliveryDate)}</dd></div>
          </dl>
          {order.notes && <p className="mt-4 text-sm text-ink-600 bg-ink-50 rounded-lg p-3">{order.notes}</p>}
        </div>

        {order.shipment && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <h2 className="font-semibold text-ink-700 mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Sevkiyat</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-ink-400">Sevk tarihi</dt><dd className="font-medium">{fmt(order.shipment.shipmentDate)}</dd></div>
              {order.shipment.deliveryNoteNo && <div><dt className="text-xs text-ink-400">İrsaliye no</dt><dd className="font-medium">{order.shipment.deliveryNoteNo}</dd></div>}
              {order.shipment.carrier && <div><dt className="text-xs text-ink-400">Taşıyıcı</dt><dd className="font-medium">{order.shipment.carrier}</dd></div>}
              {order.shipment.trackingNo && <div><dt className="text-xs text-ink-400">Takip no</dt><dd className="font-medium">{order.shipment.trackingNo}</dd></div>}
              {order.shipment.notes && <div><dt className="text-xs text-ink-400">Not</dt><dd className="font-medium">{order.shipment.notes}</dd></div>}
            </dl>
            {Array.isArray(order.shipment.items) && (
              <div className="mt-4 pt-3 border-t border-ink-100"><ShippedTable items={order.shipment.items} testId="buyer-shipped-table" /></div>
            )}
          </div>
        )}

        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <h2 className="font-semibold text-ink-700 mb-3">Geçmiş</h2>
            <ul className="space-y-2" data-testid="network-order-history">
              {[...order.statusHistory].reverse().map((h: any) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="text-ink-400 w-24 flex-shrink-0">{fmt(h.createdAt)}</span>
                  <span><b className="text-ink-700">{statusLabel(h.status, order.unit)}</b>{h.note ? <span className="text-ink-500"> — {h.note}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
