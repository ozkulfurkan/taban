import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { OrderRow } from '@/components/portal-order-row';
import { Empty, ErrorState, Loading, Segmented } from '@/components/ui';
import type { PortalOrder } from '@/core/portal';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'active' | 'shipped' | 'all';

// Siparişlerim: aktif / sevk edilen / tümü
export default function Siparisler() {
  const c = useTheme();
  const q = useApi<PortalOrder[]>('/api/portal/me/orders');
  const [filter, setFilter] = useState<Filter>('active');
  const rows = useMemo(() => (q.data ?? []).filter(o =>
    filter === 'all' ? true : filter === 'shipped' ? o.status === 'SHIPPED' : o.status !== 'SHIPPED'), [q.data, filter]);

  return (
    <>
      <Stack.Screen options={{ title: 'Siparişlerim' }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        data={q.isLoading || q.error ? [] : rows}
        keyExtractor={o => o.id}
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            <Segmented value={filter} onChange={setFilter}
              options={[{ value: 'active', label: 'Aktif' }, { value: 'shipped', label: 'Sevk edilen' }, { value: 'all', label: 'Tümü' }]} />
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? <Loading /> : q.error
            ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
            : <Empty message={filter === 'shipped' ? 'Sevk edilen sipariş yok.' : filter === 'active' ? 'Aktif sipariş yok.' : 'Henüz siparişiniz yok.'} />
        }
        renderItem={({ item, index }) => <View style={{ backgroundColor: c.card }}><OrderRow order={item} first={index === 0} /></View>}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
      />
    </>
  );
}
