// İrsaliye için sunucu verisi: firma, müşteri, sipariş ve seçilen sevkiyat (portal ve firma uçları ortak).
import { prisma } from '@/lib/prisma';
import { SHIPMENT_ORDER } from '@/lib/order-shipments';
import type { DeliveryNoteInput } from '@/lib/delivery-note-html';

export async function deliveryNoteData(where: Record<string, unknown>, shipmentId: string | null): Promise<DeliveryNoteInput | null> {
  const order = await prisma.soleOrder.findFirst({
    where: where as any,
    select: {
      orderNo: true,
      company: { select: { name: true, phone: true, address: true, taxId: true, logoUrl: true } },
      customer: { select: { name: true, address: true, taxId: true } },
      shipments: { orderBy: SHIPMENT_ORDER },
    },
  });
  if (!order || !order.shipments.length) return null;
  const idx = shipmentId ? order.shipments.findIndex(s => s.id === shipmentId) : order.shipments.length - 1;
  if (idx < 0) return null;
  const s = order.shipments[idx];
  const items = Array.isArray(s.items) ? (s.items as any[]) : [];
  return {
    company: order.company,
    customer: { name: order.customer?.name ?? '', address: order.customer?.address ?? null, taxId: order.customer?.taxId ?? null },
    orderNo: order.orderNo,
    shipment: { shipmentDate: s.shipmentDate, deliveryNoteNo: s.deliveryNoteNo, carrier: s.carrier, trackingNo: s.trackingNo, notes: s.notes },
    lines: items.map(i => ({ productCode: i?.productCode ?? '', productName: i?.productName ?? '', unit: i?.unit ?? 'çift', ordered: i?.ordered ?? null, shipped: Number(i?.shipped) || 0 })),
    sequence: { index: idx + 1, count: order.shipments.length },
  };
}
