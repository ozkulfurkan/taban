'use client';

import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Truck } from 'lucide-react';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import OrderStepper from '@/app/portal/components/order-stepper';
import { statusLabel } from '@/lib/order-status';
import { isPairUnit } from '@/lib/order-units';
import { ShippedTable } from '@/app/components/shipment-qty';

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

  if (order === undefined) return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  if (!order) return <AppShell><div className="text-center py-12 text-slate-400">Sipariş bulunamadı</div></AppShell>;

  const items: any[] = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : [{ productCode: order.productCode, productName: '', color: order.color, sizeDistribution: order.sizeDistribution, totalQuantity: order.totalQuantity }];

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">
        <BackLink href="/verilen-siparisler" label="Verilen Siparişler" />
        <div>
          <h1 className="text-xl font-bold text-slate-800" data-testid="network-order-no">{order.orderNo}</h1>
          <p className="text-sm text-slate-500">{order.link?.sellerCompany?.name} · {fmt(order.createdAt)} · {formatQty(order.totalQuantity, order.unit)}</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm overflow-x-auto">
          <h2 className="font-semibold text-slate-700 mb-3">Sipariş Durumu</h2>
          <OrderStepper status={order.status} unit={order.unit} />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-3">Kalemler</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 uppercase">
              <th className="py-2">Ürün</th><th>Renk</th>{isPairUnit(order.unit) && <th>Beden dağılımı</th>}<th className="text-right">Miktar</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2.5 font-semibold text-slate-700">{[it.productCode, it.productName].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="text-slate-600">{it.color || '—'}</td>
                  {isPairUnit(order.unit) && <td>
                    <div className="flex flex-wrap gap-1">
                      {sizes(it.sizeDistribution).map(([sz, q]) => (
                        <span key={sz} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-medium"><span className="text-blue-400">{sz}</span>×{q}</span>
                      ))}
                    </div>
                  </td>}
                  <td className="text-right font-bold text-slate-800">{formatQty(it.totalQuantity, it.unit ?? order.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-2 gap-3 text-sm mt-4">
            <div><dt className="text-xs text-slate-400">İstenen termin</dt><dd className="font-medium text-slate-700">{fmt(order.requestedDeliveryDate)}</dd></div>
            <div><dt className="text-xs text-slate-400">Onaylanan termin</dt><dd className="font-medium text-slate-700">{fmt(order.confirmedDeliveryDate)}</dd></div>
          </dl>
          {order.notes && <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{order.notes}</p>}
        </div>

        {order.shipment && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Sevkiyat</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-400">Sevk tarihi</dt><dd className="font-medium">{fmt(order.shipment.shipmentDate)}</dd></div>
              {order.shipment.deliveryNoteNo && <div><dt className="text-xs text-slate-400">İrsaliye no</dt><dd className="font-medium">{order.shipment.deliveryNoteNo}</dd></div>}
              {order.shipment.carrier && <div><dt className="text-xs text-slate-400">Taşıyıcı</dt><dd className="font-medium">{order.shipment.carrier}</dd></div>}
              {order.shipment.trackingNo && <div><dt className="text-xs text-slate-400">Takip no</dt><dd className="font-medium">{order.shipment.trackingNo}</dd></div>}
              {order.shipment.notes && <div><dt className="text-xs text-slate-400">Not</dt><dd className="font-medium">{order.shipment.notes}</dd></div>}
            </dl>
            {Array.isArray(order.shipment.items) && (
              <div className="mt-4 pt-3 border-t border-slate-100"><ShippedTable items={order.shipment.items} testId="buyer-shipped-table" /></div>
            )}
          </div>
        )}

        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-3">Geçmiş</h2>
            <ul className="space-y-2" data-testid="network-order-history">
              {[...order.statusHistory].reverse().map((h: any) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="text-slate-400 w-24 flex-shrink-0">{fmt(h.createdAt)}</span>
                  <span><b className="text-slate-700">{statusLabel(h.status, order.unit)}</b>{h.note ? <span className="text-slate-500"> — {h.note}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
