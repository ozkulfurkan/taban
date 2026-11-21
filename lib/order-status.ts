// Müşteri siparişi (SoleOrder) durumları: adlar, rozet renkleri ve ürün birimine göre adımlar.
// Saf modül: web, sunucu ve mobil (@shared/order-status) aynı kuralı kullanır.
import { isPairUnit } from './order-units';

export const ORDER_STATUS_LABEL: Record<string, string> = {
  ORDER_RECEIVED: 'Sipariş Alındı', IN_PRODUCTION: 'Üretimde', MOLDING: 'Kalıplama',
  PAINTING: 'Boya/Apre', PACKAGING: 'Paketleme', READY_FOR_SHIPMENT: 'Sevkiyata Hazır', SHIPPED: 'Sevk Edildi',
  CANCELLED: 'İptal Edildi',
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  ORDER_RECEIVED: 'bg-blue-100 text-blue-700', IN_PRODUCTION: 'bg-orange-100 text-orange-700',
  MOLDING: 'bg-purple-100 text-purple-700', PAINTING: 'bg-pink-100 text-pink-700',
  PACKAGING: 'bg-yellow-100 text-yellow-700', READY_FOR_SHIPMENT: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
};

/** Üretim aşamasındaki durumlar (listede "Üretimde" sekmesi) */
export const PRODUCTION_STATUSES = ['IN_PRODUCTION', 'MOLDING', 'PAINTING', 'PACKAGING'];

export type OrderStep = { key: string; label: string };

const PAIR_STEPS: OrderStep[] = [
  { key: 'ORDER_RECEIVED', label: 'Sipariş Alındı' },
  { key: 'IN_PRODUCTION', label: 'Üretime Girdi' },
  { key: 'MOLDING', label: 'Kalıplama' },
  { key: 'PAINTING', label: 'Boya / Apre' },
  { key: 'PACKAGING', label: 'Paketleme' },
  { key: 'READY_FOR_SHIPMENT', label: 'Sevkiyata Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
];

// Hammadde ve diğer birimli ürünlerde kalıplama/boya adımı yok
const GOODS_STEPS: OrderStep[] = [
  { key: 'ORDER_RECEIVED', label: 'Sipariş Alındı' },
  { key: 'IN_PRODUCTION', label: 'Hazırlanıyor' },
  { key: 'READY_FOR_SHIPMENT', label: 'Sevkiyata Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
];

/** Siparişin birimine göre durum adımları (çift: 7 üretim adımı, diğerleri: 4 adım) */
export const orderSteps = (unit?: string | null): OrderStep[] => (isPairUnit(unit) ? PAIR_STEPS : GOODS_STEPS);

/** Adım çizgisindeki konum; ara üretim durumları kısa akışta "Hazırlanıyor"a denk gelir */
export function stepIndexOf(status: string, unit?: string | null) {
  const steps = orderSteps(unit);
  const i = steps.findIndex(s => s.key === status);
  if (i >= 0) return i;
  return PRODUCTION_STATUSES.includes(status) ? steps.findIndex(s => s.key === 'IN_PRODUCTION') : -1;
}

/** Duruma göre okunur ad (birime göre: hammadde siparişinde IN_PRODUCTION = "Hazırlanıyor") */
export function statusLabel(status: string, unit?: string | null) {
  return orderSteps(unit).find(s => s.key === status)?.label ?? ORDER_STATUS_LABEL[status] ?? status;
}

/** Sipariş satıcı tarafından onaylanmış mı (ilerlemiş siparişler onaylı sayılır) */
export function isConfirmed(o: { status: string; confirmedAt?: string | Date | null }) {
  return !!o.confirmedAt || (o.status !== 'ORDER_RECEIVED' && o.status !== 'CANCELLED');
}

/** "Alındı" adımında onay beklenip beklenmediğine göre okunur durum: "Onay bekliyor" / "Onaylandı" */
export function stageLabel(o: { status: string; unit?: string | null; confirmedAt?: string | Date | null }) {
  if (o.status === 'ORDER_RECEIVED') return o.confirmedAt ? 'Onaylandı' : 'Onay bekliyor';
  return statusLabel(o.status, o.unit);
}
