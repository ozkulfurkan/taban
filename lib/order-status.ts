// Müşteri siparişi (SoleOrder) durum adları ve rozet renkleri
export const ORDER_STATUS_LABEL: Record<string, string> = {
  ORDER_RECEIVED: 'Sipariş Alındı', IN_PRODUCTION: 'Üretimde', MOLDING: 'Kalıplama',
  PAINTING: 'Boya/Apre', PACKAGING: 'Paketleme', READY_FOR_SHIPMENT: 'Sevkiyata Hazır', SHIPPED: 'Sevk Edildi',
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  ORDER_RECEIVED: 'bg-blue-100 text-blue-700', IN_PRODUCTION: 'bg-orange-100 text-orange-700',
  MOLDING: 'bg-purple-100 text-purple-700', PAINTING: 'bg-pink-100 text-pink-700',
  PACKAGING: 'bg-yellow-100 text-yellow-700', READY_FOR_SHIPMENT: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700',
};
