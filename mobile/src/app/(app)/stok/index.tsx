import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Empty, ErrorState, Field, ListRow, Loading, Segmented, T } from '@/components/ui';
import { formatQty, type StockItem, type StockKind } from '@/core/stock';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

type ApiProduct = { id: string; name: string; code?: string | null; unit?: string | null; stock: number; category?: { name: string } | null };
type ApiMaterial = { id: string; name: string; category?: string | null; stock: number };

// Ürün ve hammadde stokları: arama, eksiye düşenler filtresi
export default function Stok() {
  const c = useTheme();
  const params = useLocalSearchParams<{ kind?: StockKind; negative?: string }>();
  const [kind, setKind] = useState<StockKind>(params.kind === 'material' ? 'material' : 'product');
  const [negativeOnly, setNegativeOnly] = useState(params.negative === '1');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());

  const products = useApi<ApiProduct[]>(kind === 'product' ? '/api/products' : null);
  const materials = useApi<ApiMaterial[]>(kind === 'material' ? '/api/materials' : null);
  const active = kind === 'product' ? products : materials;

  const all: StockItem[] = useMemo(() => kind === 'product'
    ? (products.data ?? []).map(p => ({ id: p.id, name: p.name, code: p.code, category: p.category?.name ?? null, stock: p.stock, unit: p.unit || 'çift' }))
    : (materials.data ?? []).map(m => ({ id: m.id, name: m.name, category: m.category, stock: m.stock, unit: 'kg' }))
  , [kind, products.data, materials.data]);
  const negativeCount = all.filter(i => i.stock < 0).length;
  const rows = useMemo(() => all
    .filter(i => !negativeOnly || i.stock < 0)
    .filter(i => !q || matchesText(`${i.name} ${i.code ?? ''} ${i.category ?? ''}`, q))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  , [all, negativeOnly, q]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Stok',
          headerSearchBarOptions: {
            placeholder: kind === 'product' ? 'Ürün ara' : 'Hammadde ara',
            onChangeText: e => setSearch(e.nativeEvent.text),
            hideWhenScrolling: false, placement: 'stacked',
          },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: c.background }}
        data={active.isLoading || active.error ? [] : rows}
        keyExtractor={r => r.id}
        ListHeaderComponent={
          <View style={{ padding: 16, gap: 12 }}>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[{ value: 'product', label: 'Ürünler' }, { value: 'material', label: 'Hammaddeler' }]}
            />
            {Platform.OS === 'web' ? (
              <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Ad, kod veya kategori" testID="stock-search" />
            ) : null}
            <Pressable
              onPress={() => setNegativeOnly(v => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: negativeOnly }}
              testID="stock-negative"
              style={[styles.chip, { borderColor: negativeOnly ? c.danger : c.border, backgroundColor: negativeOnly ? c.dangerSoft : c.card }]}
            >
              <T color={negativeOnly ? c.danger : c.text} style={{ fontWeight: '600' }}>
                Eksiye düşenler{negativeCount ? ` (${negativeCount})` : ''}
              </T>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          active.isLoading ? <Loading /> : active.error
            ? <ErrorState message={(active.error as Error).message} onRetry={() => { void active.refetch(); }} />
            : <Empty message={negativeOnly ? 'Eksiye düşen kalem yok.' : q ? 'Aramaya uyan kayıt yok.' : kind === 'product' ? 'Henüz ürün yok.' : 'Henüz hammadde yok.'} />
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: c.card }}>
            <ListRow
              testID={`stock-${item.id}`}
              title={item.name}
              subtitle={[item.code, item.category].filter(Boolean).join(' · ') || undefined}
              right={`${formatQty(item.stock)} ${item.unit}`}
              rightColor={item.stock < 0 ? c.danger : item.stock === 0 ? c.textSecondary : c.text}
              onPress={() => router.push(`/stok/${kind}/${item.id}`)}
            />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => { void active.refetch(); }} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
