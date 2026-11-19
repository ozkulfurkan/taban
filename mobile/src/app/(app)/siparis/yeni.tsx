import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { OrderCatalog } from '@/components/order-catalog';
import { Picker } from '@/components/picker';
import { Loading } from '@/components/ui';
import { useApi } from '@/core/query';

type Customer = { id: string; name: string; currency?: string };

// Portal dışından (telefon, e-posta, yüz yüze) gelen siparişi personel girer:
// önce müşteri seçilir, sonra firmanın kendi ürünlerinden sepet oluşturulur (çift: beden asortisi, kg/metre: miktar).
export default function NewIncomingOrder() {
  const params = useLocalSearchParams<{ customerId?: string }>();
  const [customerId, setCustomerId] = useState<string | null>(params.customerId ?? null);
  const customers = useApi<Customer[]>('/api/customers', { minimal: 'true' });
  const customer = customers.data?.find(x => x.id === customerId) ?? null;

  if (!customerId) {
    return (
      <>
        <Stack.Screen options={{ title: 'Yeni sipariş' }} />
        <Loading />
        <Picker
          visible
          title="Sipariş hangi müşteriden?"
          items={(customers.data ?? []).map(x => ({ id: x.id, title: x.name, right: x.currency }))}
          loading={customers.isLoading}
          onPick={setCustomerId}
          onClose={() => router.back()}
        />
      </>
    );
  }

  return (
    <OrderCatalog
      title={customer ? `${customer.name} · Sipariş` : 'Yeni sipariş'}
      catalogUrl="/api/products"
      orderUrl="/api/orders"
      extraBody={{ customerId }}
      ordersKey="/api/orders"
      detailHref={id => `/siparis/gelen/${id}`}
      sentTitle="Sipariş kaydedildi"
    />
  );
}
