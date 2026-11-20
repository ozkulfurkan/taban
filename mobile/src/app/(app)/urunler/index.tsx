import { Stack, router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Empty, ErrorState, Field, ListRow, Loading } from '@/components/ui';
import { useCanWrite } from '@/core/auth';
import { money } from '@/core/format';
import { useApi } from '@/core/query';
import { formatQty } from '@/core/stock';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

type Product = {
  id: string; name: string; code?: string | null; unit?: string | null; stock: number;
  unitPrice?: number | null; currency?: string | null; category?: { name: string } | null;
};

// Ürünler: liste, arama, + ile yeni ürün. Satıra dokununca ürün/stok detayı açılır.
export default function Urunler() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const products = useApi<Product[]>('/api/products');

  const rows = useMemo(() => (products.data ?? [])
    .filter(p => !q || matchesText(`${p.name} ${p.code ?? ''} ${p.category?.name ?? ''}`, q))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  , [products.data, q]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Ürünler',
          headerSearchBarOptions: { placeholder: 'Ad, kod veya kategori', onChangeText: e => setSearch(e.nativeEvent.text), hideWhenScrolling: false, placement: 'stacked' },
          headerRight: canWrite ? () => (
            <Pressable onPress={() => router.push('/urunler/yeni')} accessibilityRole="button" accessibilityLabel="Yeni ürün" hitSlop={10} testID="product-new">
              <Icon name="plus" size={24} color={c.primary} />
            </Pressable>
          ) : undefined,
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: c.background }}
        data={products.isLoading || products.error ? [] : rows}
        keyExtractor={r => r.id}
        ListHeaderComponent={Platform.OS === 'web' ? (
          <View style={{ padding: 16 }}>
            <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Ad, kod veya kategori" testID="product-search" />
          </View>
        ) : undefined}
        ListEmptyComponent={
          products.isLoading ? <Loading /> : products.error
            ? <ErrorState message={(products.error as Error).message} onRetry={() => { void products.refetch(); }} />
            : <Empty message={q ? 'Aramaya uyan ürün yok.' : canWrite ? 'Henüz ürün yok. Sağ üstteki + ile ekleyin.' : 'Henüz ürün yok.'} />
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: c.card }}>
            <ListRow
              testID={`product-${item.id}`}
              title={item.name}
              subtitle={[item.code, item.category?.name, `Stok ${formatQty(item.stock)} ${item.unit || 'çift'}`].filter(Boolean).join(' · ')}
              right={item.unitPrice ? money(item.unitPrice, item.currency || 'TRY') : undefined}
              onPress={() => router.push(`/stok/product/${item.id}`)}
            />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => { void products.refetch(); }} />}
      />
    </>
  );
}
