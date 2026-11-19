import { Stack, useLocalSearchParams } from 'expo-router';

import { OrderDetailBody } from '@/components/order-detail';
import { ErrorState, Loading, Screen } from '@/components/ui';
import type { PortalOrder } from '@/core/portal';
import { useApi } from '@/core/query';

// Bağlı SoleCost tedarikçisine verilen siparişin durumu, kalemleri ve sevkiyatı
export default function VerilenSiparis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<PortalOrder & { link?: { sellerCompany: { name: string } } | null }>(`/api/network/orders/${id}`);
  if (q.isLoading) return <><Stack.Screen options={{ title: 'Sipariş' }} /><Loading /></>;
  if (q.error || !q.data) return <><Stack.Screen options={{ title: 'Sipariş' }} /><ErrorState message={(q.error as Error)?.message || 'Sipariş bulunamadı'} onRetry={() => { void q.refetch(); }} /></>;
  return (
    <>
      <Stack.Screen options={{ title: q.data.orderNo }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <OrderDetailBody order={q.data} subtitle={q.data.link?.sellerCompany.name} />
      </Screen>
    </>
  );
}
