import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, RefreshControl, View } from 'react-native';

import { Empty, ErrorState, Field, ListRow, Loading, Segmented, T } from '@/components/ui';
import { api } from '@/core/api';
import { money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

type Party = { id: string; name: string; phone?: string | null; currency: string; balance: number };
type Kind = 'customer' | 'supplier';

export default function Cariler() {
  const c = useTheme();
  const params = useLocalSearchParams<{ kind?: Kind }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'supplier' ? 'supplier' : 'customer');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());

  // Müşteriler sunucuda sayfalı ve aranır; tedarikçi listesi tek parça gelir, burada süzülür
  const customers = useInfiniteQuery({
    queryKey: ['customers', q],
    enabled: kind === 'customer',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<{ customers: Party[]; page: number; totalPages: number }>('/api/customers', { query: { page: pageParam, search: q }, signal }),
    getNextPageParam: last => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const suppliers = useApi<Party[]>(kind === 'supplier' ? '/api/suppliers' : null);

  const rows: Party[] = useMemo(() => {
    if (kind === 'customer') return customers.data?.pages.flatMap(p => p.customers) ?? [];
    return (suppliers.data ?? []).filter(s => !q || matchesText(s.name, q));
  }, [kind, customers.data, suppliers.data, q]);

  const active = kind === 'customer' ? customers : suppliers;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Cariler',
          headerSearchBarOptions: {
            placeholder: kind === 'customer' ? 'Müşteri ara' : 'Tedarikçi ara',
            onChangeText: e => setSearch(e.nativeEvent.text),
            hideWhenScrolling: false,
          },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        data={active.isLoading || active.error ? [] : rows}
        keyExtractor={r => r.id}
        ListHeaderComponent={
          <View style={{ padding: 16, gap: 12 }}>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[{ value: 'customer', label: 'Müşteriler' }, { value: 'supplier', label: 'Tedarikçiler' }]}
            />
            {Platform.OS === 'web' ? (
              <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Cari adı" testID="cari-search" />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          active.isLoading ? <Loading /> : active.error
            ? <ErrorState message={(active.error as Error).message} onRetry={() => active.refetch()} />
            : <Empty message={q ? 'Aramaya uyan cari yok.' : 'Henüz kayıt yok.'} />
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: c.card }}>
            <ListRow
              testID={`cari-${item.id}`}
              title={item.name}
              subtitle={item.phone || undefined}
              right={money(item.balance, item.currency)}
              rightSub={balanceHint(kind, item.balance)}
              rightColor={Math.abs(item.balance) < 0.005 ? c.textSecondary : (item.balance > 0) === (kind === 'customer') ? c.success : c.danger}
              onPress={() => router.push(`/cariler/${kind}/${item.id}`)}
            />
          </View>
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (kind === 'customer' && customers.hasNextPage && !customers.isFetchingNextPage) customers.fetchNextPage(); }}
        ListFooterComponent={customers.isFetchingNextPage ? <T variant="small" style={{ textAlign: 'center', padding: 16 }}>Yükleniyor…</T> : undefined}
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => { void active.refetch(); }} />}
      />
    </>
  );
}

function balanceHint(kind: Kind, b: number) {
  if (Math.abs(b) < 0.005) return 'kapalı';
  if (kind === 'customer') return b > 0 ? 'alacak' : 'borç';
  return b > 0 ? 'borç' : 'alacak';
}
