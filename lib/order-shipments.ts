// Bir siparişin sevkiyatları (kısmi sevkiyat): sorgularda `shipments` alınır, yanıtta eski istemciler (mobil)
// için `shipment` = son sevkiyat da verilir.
export const SHIPMENT_ORDER = [{ shipmentDate: 'asc' as const }, { createdAt: 'asc' as const }];
export const SHIPMENT_PUBLIC_SELECT = {
  id: true, shipmentDate: true, deliveryNoteNo: true, trackingNo: true, carrier: true, notes: true, items: true, totalQuantity: true, createdAt: true,
} as const;

/** shipments dizisine göre `shipment` (son sevkiyat ya da null) ekler */
export function withLastShipment<T>(o: T): T & { shipment: any } {
  const list = Array.isArray((o as any)?.shipments) ? (o as any).shipments : [];
  return { ...o, shipment: list.length ? list[list.length - 1] : null };
}
