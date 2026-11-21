import { Stack, router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ProductThumb } from '@/components/product-image';
import { Button, Empty, ErrorState, Field, Loading, T } from '@/components/ui';
import { useCanWrite } from '@/core/auth';
import { notify } from '@/core/dialog';
import { setPortalVisibility } from '@/core/portal-visibility';
import { money } from '@/core/format';
import { useApi } from '@/core/query';
import { formatQty } from '@/core/stock';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesText } from '@shared/search';

type Product = {
  id: string; name: string; code?: string | null; unit?: string | null; stock: number;
  unitPrice?: number | null; currency?: string | null; category?: { name: string } | null; imageUpdatedAt?: string | null;
  portalVisible?: boolean;
};

// Ürünler: liste, arama, + ile yeni ürün. Satıra dokununca ürün/stok detayı açılır.
export default function Urunler() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const products = useApi<Product[]>('/api/products');
  // Çoklu seçim: seçilen ürünler tek seferde portalda gösterilir / gizlenir
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const toggle = (pid: string) => setSelected(prev => { const n = new Set(prev); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const endSelect = () => { setSelecting(false); setSelected(new Set()); };
  const applyPortal = async (visible: boolean) => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const r = await setPortalVisibility([...selected], visible);
      await products.refetch();
      notify(visible ? 'Portalda gösteriliyor' : 'Portalda gizlendi', `${r.updated} ürün`, 'success');
      endSelect();
    } catch (e: any) {
      notify('Kaydedilemedi', e?.message || '', 'error');
    } finally {
      setBusy(false);
    }
  };

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <Pressable onPress={() => (selecting ? endSelect() : setSelecting(true))} accessibilityRole="button" hitSlop={10} testID="product-select">
                <T color={c.primary} style={{ fontWeight: '600' }}>{selecting ? 'Vazgeç' : 'Seç'}</T>
              </Pressable>
              {selecting ? null : (
                <Pressable onPress={() => router.push('/urunler/yeni')} accessibilityRole="button" accessibilityLabel="Yeni ürün" hitSlop={10} testID="product-new">
                  <Icon name="plus" size={24} color={c.primary} />
                </Pressable>
              )}
            </View>
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
          <Pressable
            testID={`product-${item.id}`}
            accessibilityRole="button"
            onPress={() => (selecting ? toggle(item.id) : router.push(`/stok/product/${item.id}`))}
            accessibilityState={selecting ? { checked: selected.has(item.id) } : undefined}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.background : selected.has(item.id) ? c.primarySoft : c.card, borderBottomColor: c.border }]}
          >
            {selecting ? (
              <View style={[styles.check, { borderColor: selected.has(item.id) ? c.primary : c.border, backgroundColor: selected.has(item.id) ? c.primary : 'transparent' }]}>
                {selected.has(item.id) ? <T color={c.primaryText} style={{ fontSize: 13, fontWeight: '800' }}>✓</T> : null}
              </View>
            ) : null}
            <ProductThumb productId={item.id} imageUpdatedAt={item.imageUpdatedAt} size={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontWeight: '600' }} numberOfLines={1}>{item.name}</T>
              <T variant="small" numberOfLines={1}>
                {[item.code, item.category?.name, `Stok ${formatQty(item.stock)} ${item.unit || 'çift'}`].filter(Boolean).join(' · ')}
              </T>
              {item.portalVisible ? <T variant="small" color={c.success} testID={`product-portal-${item.id}`}>Portalda görünüyor</T> : null}
            </View>
            {item.unitPrice ? <T variant="money">{money(item.unitPrice, item.currency || 'TRY')}</T> : null}
            {selecting ? null : <Icon name="chevron" size={14} color={c.textMuted} />}
          </Pressable>
        )}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => { void products.refetch(); }} />}
      />
      {selecting ? (
        <View style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: 12 + insets.bottom }]} testID="product-select-bar">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T style={{ fontWeight: '600' }}>{selected.size} ürün seçildi</T>
            <Pressable onPress={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))} hitSlop={8}>
              <T color={c.primary}>{selected.size === rows.length && rows.length ? 'Seçimi kaldır' : 'Tümünü seç'}</T>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Portalda göster" icon="check" onPress={() => { void applyPortal(true); }} loading={busy} disabled={!selected.size} style={{ flex: 1 }} testID="product-portal-show" />
            <Button title="Gizle" variant="secondary" onPress={() => { void applyPortal(false); }} disabled={!selected.size || busy} style={{ flex: 1 }} testID="product-portal-hide" />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
});
