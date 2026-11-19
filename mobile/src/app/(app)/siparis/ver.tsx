import { useLocalSearchParams } from 'expo-router';

import { OrderCatalog } from '@/components/order-catalog';

// Bağlı SoleCost tedarikçisine sipariş: tedarikçinin kataloğu (fiyatsız), birime göre miktar, sepet
export default function TedarikciyeSiparis() {
  const { linkId, name } = useLocalSearchParams<{ linkId: string; name?: string }>();
  return (
    <OrderCatalog
      title={name ? `${name} · Sipariş` : 'Sipariş ver'}
      catalogUrl={`/api/network/links/${linkId}/catalog`}
      orderUrl={`/api/network/links/${linkId}/orders`}
      ordersKey="/api/network/orders"
      detailHref={id => `/siparis/verilen/${id}`}
    />
  );
}
