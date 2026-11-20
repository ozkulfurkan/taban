import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { Empty, ErrorState, Field, ListRow, Loading, Segmented } from '@/components/ui';
import { api } from '@/core/api';
import { useCanWrite } from '@/core/auth';
import { formatDate, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

type Tab = 'sale' | 'return' | 'purchase';
type Invoice = { id: string; invoiceNo: string; date: string; total: number; currency: string; status: string; isReturn: boolean; customer?: { name: string } };
type Purchase = { id: string; invoiceNo: string | null; date: string; total: number; currency: string; isReturn: boolean; supplier?: { name: string } };

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  PAID: { label: 'Ödendi', tone: 'success' },
  PARTIAL: { label: 'Kısmi', tone: 'warning' },
  PENDING: { label: 'Açık', tone: 'neutral' },
};

export default function Belgeler() {
  const c = useTheme();
  const canWrite = useCanWrite();
  // Ana menüden ?tab=sale|return|purchase ile açılır
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'purchase' || params.tab === 'return' ? params.tab : 'sale');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [newOpen, setNewOpen] = useState(false);

  const invoices = useInfiniteQuery({
    queryKey: ['invoices', tab, q],
    enabled: tab !== 'purchase',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<{ items: Invoice[]; page: number; totalPages: number }>('/api/invoices', { query: { page: pageParam, type: tab, q }, signal }),
    getNextPageParam: last => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const purchases = useApi<Purchase[]>(tab === 'purchase' ? '/api/purchases' : null);

  type Row = { id: string; href: Href; no: string; party: string; date: string; total: number; currency: string; badge?: { label: string } };
  const rows = useMemo((): Row[] => {
    if (tab !== 'purchase') return (invoices.data?.pages.flatMap(p => p.items) ?? []).map(i => ({
      id: i.id, href: `/belgeler/satis/${i.id}`, no: i.invoiceNo, party: i.customer?.name ?? '', date: i.date,
      total: i.total, currency: i.currency, badge: STATUS[i.status],
    }));
    return (purchases.data ?? [])
      .filter(p => !q || matchesText(`${p.invoiceNo ?? ''} ${p.supplier?.name ?? ''}`, q))
      .map(p => ({
        id: p.id, href: `/belgeler/alis/${p.id}`, no: p.invoiceNo ?? '—', party: p.supplier?.name ?? '', date: p.date,
        total: p.total, currency: p.currency, badge: p.isReturn ? { label: 'İade', tone: 'warning' as const } : undefined,
      }));
  }, [tab, invoices.data, purchases.data, q]);

  const active = tab === 'purchase' ? purchases : invoices;
  const create = (kind: string) => router.push(`/belgeler/yeni?kind=${kind}`);
  // +: Satışlar'da doğrudan satış, Alışlar'da doğrudan alış; İadeler'de iade yönü seçilir
  const onNew = () => (tab === 'sale' ? create('sale') : tab === 'purchase' ? create('purchase') : setNewOpen(true));

  return (
    <>
      <Stack.Screen
        options={{
          title: tab === 'sale' ? 'Satışlar' : tab === 'return' ? 'İadeler' : 'Alışlar',
          headerSearchBarOptions: { placeholder: 'Belge no ya da cari', onChangeText: e => setSearch(e.nativeEvent.text), hideWhenScrolling: false, placement: 'stacked' },
          headerRight: canWrite ? () => (
            <Pressable onPress={onNew} accessibilityRole="button"
              accessibilityLabel={tab === 'sale' ? 'Yeni satış' : tab === 'purchase' ? 'Yeni alış' : 'Yeni iade'} hitSlop={10} testID="doc-new">
              <Icon name="plus" size={24} color={c.primary} />
            </Pressable>
          ) : undefined,
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        data={active.isLoading || active.error ? [] : rows}
        keyExtractor={r => r.id}
        ListHeaderComponent={
          <View style={{ padding: 16, gap: 12 }}>
            <Segmented value={tab} onChange={setTab}
              options={[{ value: 'sale', label: 'Satış' }, { value: 'return', label: 'İade' }, { value: 'purchase', label: 'Alış' }]} />
            {Platform.OS === 'web' ? <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Belge no ya da cari" testID="doc-search" /> : null}
          </View>
        }
        ListEmptyComponent={
          active.isLoading ? <Loading /> : active.error
            ? <ErrorState message={(active.error as Error).message} onRetry={() => { void active.refetch(); }} />
            : <Empty message={q ? 'Aramaya uyan belge yok.' : 'Henüz belge yok.'} />
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: c.card }}>
            <ListRow
              testID={`doc-${item.id}`}
              title={`${item.no} · ${item.party}`}
              subtitle={formatDate(item.date)}
              right={money(item.total, item.currency)}
              rightSub={item.badge?.label}
              onPress={() => router.push(item.href)}
            />
          </View>
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (tab !== 'purchase' && invoices.hasNextPage && !invoices.isFetchingNextPage) void invoices.fetchNextPage(); }}
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => { void active.refetch(); }} />}
      />
      <Sheet
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        title="Yeni iade"
        actions={[
          { label: 'Müşteriden iade', icon: 'arrowDown', onPress: () => create('return'), testID: 'new-return' },
          { label: 'Tedarikçiye iade', icon: 'arrowUp', onPress: () => create('purchaseReturn'), testID: 'new-purchase-return' },
        ]}
      />
    </>
  );
}
