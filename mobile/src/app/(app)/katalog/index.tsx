import { Stack } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Picker } from '@/components/picker';
import { ProductThumb } from '@/components/product-image';
import { Button, Card, Empty, ErrorState, Field, Loading, T } from '@/components/ui';
import { shareCatalogPdf } from '@/core/catalog-pdf';
import { notify } from '@/core/dialog';
import { money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

type Product = {
  id: string; name: string; code?: string | null; unit?: string | null; unitPrice?: number | null; currency?: string | null;
  imageUpdatedAt?: string | null; category?: { name: string } | null;
};

// Katalog: müşteriye gönderilecek ürünler seçilir, fotoğraflı PDF hazırlanıp paylaşılır
export default function Katalog() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const products = useApi<Product[]>('/api/products');
  const customers = useApi<{ id: string; name: string }[]>('/api/customers', { minimal: 'true' });

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [title, setTitle] = useState('Ürün Kataloğu');
  const [customerName, setCustomerName] = useState('');
  const [showPrices, setShowPrices] = useState(true);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (products.data ?? [])
    .filter(p => !q || matchesText(`${p.name} ${p.code ?? ''} ${p.category?.name ?? ''}`, q))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  , [products.data, q]);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const withoutPhoto = (products.data ?? []).filter(p => chosen.has(p.id) && !p.imageUpdatedAt).length;

  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const allShown = rows.length > 0 && rows.every(r => chosen.has(r.id));
  const toggleAll = () => setSelected(s => (allShown
    ? s.filter(id => !rows.some(r => r.id === id))
    : [...s, ...rows.map(r => r.id).filter(id => !s.includes(id))]));

  const make = async () => {
    if (!selected.length) { notify('Ürün seçin', 'Katalogda yer alacak ürünleri işaretleyin.'); return; }
    setBusy(true);
    try { await shareCatalogPdf(selected, { title: title.trim() || 'Ürün Kataloğu', customerName: customerName.trim() || undefined, showPrices }); }
    catch (e: any) { notify('PDF oluşturulamadı', e?.message || ''); }
    finally { setBusy(false); }
  };

  const header = (
    <View style={{ padding: 16, gap: 12 }}>
      <Card>
        <Field label="Katalog başlığı" value={title} onChangeText={setTitle} testID="catalog-title" />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Müşteri (isteğe bağlı)" value={customerName} onChangeText={setCustomerName} placeholder="Sayın …" testID="catalog-customer" />
          </View>
          <Button title="Seç" variant="secondary" icon="people" onPress={() => setPickCustomer(true)} />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>Fiyatları göster</T>
            <T variant="small">Kapalıysa katalogda fiyat yerine iletişim notu yer alır.</T>
          </View>
          <Switch value={showPrices} onValueChange={setShowPrices} trackColor={{ true: c.primary }} testID="catalog-prices" />
        </View>
      </Card>
      {Platform.OS === 'web' ? <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Ad, kod veya kategori" /> : null}
      <View style={styles.listHead}>
        <T variant="label" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Ürünler · {selected.length} seçili</T>
        {rows.length ? (
          <Pressable onPress={toggleAll} hitSlop={8} accessibilityRole="button" testID="catalog-all">
            <T color={c.primary} style={{ fontWeight: '600' }}>{allShown ? 'Seçimi kaldır' : 'Tümünü seç'}</T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Katalog',
          headerSearchBarOptions: { placeholder: 'Ürün ara', onChangeText: e => setSearch(e.nativeEvent.text), hideWhenScrolling: false, placement: 'stacked' },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: c.background }}
        contentContainerStyle={{ paddingBottom: 120 }}
        data={products.isLoading || products.error ? [] : rows}
        keyExtractor={r => r.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          products.isLoading ? <Loading /> : products.error
            ? <ErrorState message={(products.error as Error).message} onRetry={() => { void products.refetch(); }} />
            : <Empty message={q ? 'Aramaya uyan ürün yok.' : 'Henüz ürün yok. Ana menüden Ürünler ile ekleyin.'} />
        }
        renderItem={({ item }) => {
          const on = chosen.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              testID={`catalog-${item.id}`}
              style={({ pressed }) => [styles.row, { backgroundColor: on ? c.primarySoft : c.card, borderBottomColor: c.border }, pressed && { opacity: 0.8 }]}
            >
              <ProductThumb productId={item.id} imageUpdatedAt={item.imageUpdatedAt} size={56} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '600' }} numberOfLines={1}>{item.name}</T>
                <T variant="small" numberOfLines={1}>
                  {[item.code, item.category?.name, item.imageUpdatedAt ? null : 'fotoğraf yok'].filter(Boolean).join(' · ') || ' '}
                </T>
                {item.unitPrice ? <T variant="small" color={c.text}>{money(item.unitPrice, item.currency || 'TRY')} / {item.unit || 'çift'}</T> : null}
              </View>
              <Icon name={on ? 'checkbox' : 'circle'} size={26} color={on ? c.primary : c.textMuted} />
            </Pressable>
          );
        }}
      />
      <View style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: insets.bottom + 12 }]}>
        {withoutPhoto ? <T variant="small" style={{ textAlign: 'center' }}>{withoutPhoto} ürünün fotoğrafı yok; katalogda kod ile gösterilir.</T> : null}
        <Button
          title={selected.length ? `PDF hazırla (${selected.length} ürün)` : 'PDF hazırla'}
          icon="pdf"
          onPress={make}
          loading={busy}
          disabled={!selected.length}
          testID="catalog-pdf"
        />
      </View>
      <Picker
        visible={pickCustomer}
        title="Müşteri"
        loading={customers.isLoading}
        items={(customers.data ?? []).map(x => ({ id: x.id, title: x.name }))}
        onPick={id => { setCustomerName(customers.data?.find(x => x.id === id)?.name ?? ''); setPickCustomer(false); }}
        onClose={() => setPickCustomer(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
