import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useNavigation, usePreventRemove } from 'expo-router';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Empty, ErrorState, Field, ListRow, Loading, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/core/api';
import { confirm, notify } from '@/core/dialog';
import { cartItem, formatQty, isPairUnit, orderBody, orderUnit, sizeSummary, sizesOf, unitDecimals, type CatalogProduct, type OrderItem } from '@/core/portal';
import { formatAmountInput } from '@/core/amount';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

// Katalog ve sepet: ürün seç → renk + beden adetleri → sepete ekle → siparişi gönder.
// Web portalındaki gibi sepet tek bir paket sipariş olarak gönderilir.
export type CatalogProps = {
  /** Katalog adresi: portalda ürün dizisi, firma ağında { sellerName, products } döner */
  catalogUrl: string;
  /** Siparişin gönderileceği adres */
  orderUrl: string;
  title?: string;
  /** Gönderilen siparişten sonra yenilenecek liste (React Query anahtarı) */
  ordersKey: string;
  /** Sipariş gönderilince açılacak detay */
  detailHref: (orderId: string) => string;
  /** Gövdeye eklenecek alanlar (personel siparişinde müşteri: { customerId }) */
  extraBody?: Record<string, unknown>;
  /** Gönderilince gösterilecek başlık (varsayılan: "Siparişiniz alındı") */
  sentTitle?: string;
};

// Katalog ve sepet: portal müşterisi ve bağlı SoleCost tedarikçisine sipariş veren firma ortak kullanır
export function OrderCatalog({ catalogUrl, orderUrl, title = 'Katalog', ordersKey, detailHref, extraBody, sentTitle = 'Siparişiniz alındı' }: CatalogProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useApi<CatalogProduct[] | { products: CatalogProduct[] }>(catalogUrl);
  const products: CatalogProduct[] = useMemo(() => (Array.isArray(q.data) ? q.data : q.data?.products ?? []), [q.data]);
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const [active, setActive] = useState<CatalogProduct | null>(null);
  const [cart, setCart] = useState<(OrderItem & { key: string })[]>([]);
  const [checkout, setCheckout] = useState(false);

  const rows = useMemo(
    () => products.filter(p => !term || matchesText(`${p.code ?? ''} ${p.name} ${p.description ?? ''}`, term)),
    [products, term],
  );
  const total = cart.reduce((s, i) => s + i.totalQuantity, 0);
  const cartUnit = cart[0]?.unit;

  // Gönderilmemiş sepetle geri çıkılırsa onay iste
  const navigation = useNavigation();
  const sent = useRef(false);
  usePreventRemove(cart.length > 0, ({ data }) => {
    if (sent.current) return navigation.dispatch(data.action);
    void confirm('Sepet boşaltılsın mı?', 'Gönderilmemiş sepetteki ürünler silinecek.', 'Çık', true)
      .then(ok => { if (ok) navigation.dispatch(data.action); });
  });

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerSearchBarOptions: { placeholder: 'Model ara', onChangeText: e => setSearch(e.nativeEvent.text), hideWhenScrolling: false },
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          data={q.isLoading || q.error ? [] : rows}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingBottom: cart.length ? 120 : 24 }}
          ListHeaderComponent={Platform.OS === 'web' ? (
            <View style={{ padding: 16 }}>
              <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Model kodu veya adı" testID="catalog-search" />
            </View>
          ) : <View style={{ height: 8 }} />}
          ListEmptyComponent={
            q.isLoading ? <Loading /> : q.error
              ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
              : <Empty message={term ? 'Aramaya uyan model yok.' : 'Katalogda henüz ürün yok. Firmanızla iletişime geçin.'} />
          }
          renderItem={({ item }) => {
            const inCart = cart.filter(i => i.productId === item.id).reduce((s, i) => s + i.totalQuantity, 0);
            return (
              <View style={{ backgroundColor: c.card }}>
                <ListRow
                  testID={`catalog-${item.id}`}
                  title={item.code ? `${item.code} · ${item.name}` : item.name}
                  subtitle={item.description || (isPairUnit(item.unit) ? `Beden ${sizesOf(item)[0]}–${sizesOf(item).at(-1)}` : `Birim: ${orderUnit(item.unit)}`)}
                  right={inCart ? formatQty(inCart, item.unit) : undefined}
                  rightSub={inCart ? 'sepette' : undefined}
                  rightColor={c.primary}
                  onPress={() => setActive(item)}
                />
              </View>
            );
          }}
        />

        {cart.length ? (
          <View style={[styles.cartBar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: insets.bottom + 12 }]}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }} testID="cart-summary">{cart.length} kalem · {formatQty(total, cartUnit)}</T>
              <T variant="small">Sepeti gözden geçirip gönderin</T>
            </View>
            <Button title="Sepet" icon="cart" onPress={() => setCheckout(true)} testID="cart-open" />
          </View>
        ) : null}
      </View>

      {active ? (
        <AddToCart
          key={active.id}
          product={active}
          onClose={() => setActive(null)}
          cartUnit={cartUnit}
          onAdd={item => { setCart(cs => [...cs, { ...item, key: `${Date.now()}-${cs.length}` }]); setActive(null); }}
        />
      ) : null}

      {checkout ? (
        <Checkout
          orderUrl={orderUrl}
          extraBody={extraBody}
          items={cart}
          onRemove={key => setCart(cs => { const next = cs.filter(i => i.key !== key); if (!next.length) setCheckout(false); return next; })}
          onClose={() => setCheckout(false)}
          onSent={async order => {
            sent.current = true;
            setCheckout(false);
            setCart([]);
            await qc.invalidateQueries({ queryKey: [ordersKey] });
            router.replace(detailHref(order.id) as any);
            notify(sentTitle, `${order.orderNo} · ${formatQty(total, cartUnit)}`);
          }}
        />
      ) : null}
    </>
  );
}

function BottomSheet({ title, subtitle, onClose, children, testID }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; testID?: string }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + Spacing.three }]} testID={testID}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <T variant="heading" numberOfLines={1}>{title}</T>
          {subtitle ? <T variant="small">{subtitle}</T> : null}
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: Spacing.three }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddToCart({ product, cartUnit, onAdd, onClose }: { product: CatalogProduct; cartUnit?: string; onAdd: (i: OrderItem) => void; onClose: () => void }) {
  const c = useTheme();
  const sizes = sizesOf(product);
  const unit = orderUnit(product.unit);
  const pair = isPairUnit(unit);
  const [color, setColor] = useState('');
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const sum = sizes.reduce((s, sz) => s + (parseInt(raw[sz] || '0', 10) || 0), 0);

  const add = () => {
    // Sepette tek birim: farklı birimli ürünler ayrı siparişte gönderilir
    if (cartUnit && cartUnit !== unit) return setError(`Sepette ${cartUnit} birimli ürün var. ${unit} birimli ürünü ayrı bir siparişte gönderin.`);
    const r = cartItem(product, color, raw, qty);
    if (typeof r === 'string') return setError(r);
    onAdd(r);
  };

  return (
    <BottomSheet title={product.code ? `${product.code} · ${product.name}` : product.name} subtitle={product.description || undefined} onClose={onClose} testID="add-to-cart">
      <Field label={pair ? 'Renk' : 'Renk / açıklama (isteğe bağlı)'} value={color} onChangeText={v => { setColor(v); setError(''); }} placeholder="örn. Siyah" testID="cart-color" />
      {pair ? <View style={{ gap: 6 }}>
        <T variant="label">Beden adetleri (çift)</T>
        <View style={styles.sizes}>
          {sizes.map(sz => (
            <View key={sz} style={[styles.size, { borderColor: raw[sz] ? c.primary : c.border, backgroundColor: c.background }]}>
              <T variant="small" style={{ textAlign: 'center' }}>{sz}</T>
              <TextInput
                value={raw[sz] ?? ''}
                onChangeText={v => { setRaw(r => ({ ...r, [sz]: v.replace(/\D/g, '').slice(0, 6) })); setError(''); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
                accessibilityLabel={`${sz} beden adet`}
                testID={`size-${sz}`}
                style={[styles.sizeInput, { color: c.text }]}
              />
            </View>
          ))}
        </View>
      </View> : (
        <Field
          label={`Miktar (${unit})`}
          value={qty}
          onChangeText={v => { setQty(formatAmountInput(v, unitDecimals(unit))); setError(''); }}
          keyboardType={unitDecimals(unit) ? 'decimal-pad' : 'number-pad'}
          placeholder="0"
          testID="cart-qty"
        />
      )}
      {error ? <T color={c.danger} testID="cart-error">{error}</T> : null}
      <Button title={pair ? (sum ? `Sepete ekle · ${sum} çift` : 'Sepete ekle') : 'Sepete ekle'} icon="plus" onPress={add} testID="cart-add" />
    </BottomSheet>
  );
}

function Checkout({ orderUrl, extraBody, items, onRemove, onClose, onSent }: {
  orderUrl: string;
  extraBody?: Record<string, unknown>;
  items: (OrderItem & { key: string })[]; onRemove: (key: string) => void; onClose: () => void;
  onSent: (o: { id: string; orderNo: string }) => void;
}) {
  const c = useTheme();
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const total = items.reduce((s, i) => s + i.totalQuantity, 0);

  const send = async () => {
    setError('');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Termini YYYY-AA-GG biçiminde girin ya da boş bırakın.');
    setSaving(true);
    try {
      const order = await api<{ id: string; orderNo: string }>(orderUrl, { method: 'POST', body: { ...orderBody(items, date, notes), ...extraBody } });
      onSent(order);
    } catch (e: any) {
      setError(e?.message || 'Sipariş gönderilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet title="Sepet" subtitle={`${items.length} kalem · ${formatQty(total, items[0]?.unit)}`} onClose={onClose} testID="checkout">
      <View style={[styles.box, { borderColor: c.border }]}>
        {items.map((i, idx) => (
          <View key={i.key} style={[styles.cartRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontWeight: '600' }} numberOfLines={1}>{[i.productCode || i.productName, i.color].filter(Boolean).join(' · ')}</T>
              {isPairUnit(i.unit) ? <T variant="small" numberOfLines={2}>{sizeSummary(i.sizeDistribution)}</T> : null}
            </View>
            <T style={{ fontWeight: '700' }}>{formatQty(i.totalQuantity, i.unit)}</T>
            <Pressable onPress={() => onRemove(i.key)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Kalemi sil" testID={`cart-remove-${idx}`}>
              <T color={c.danger}>Sil</T>
            </Pressable>
          </View>
        ))}
      </View>
      <Field label="İstenen termin (YYYY-AA-GG)" value={date} onChangeText={setDate} placeholder="İsteğe bağlı" autoCapitalize="none" testID="checkout-date" />
      <Field label="Not" value={notes} onChangeText={setNotes} placeholder="İsteğe bağlı" multiline style={{ minHeight: 60, paddingTop: 12 }} testID="checkout-notes" />
      {error ? <T color={c.danger} testID="checkout-error">{error}</T> : null}
      <Button title={`Siparişi gönder · ${formatQty(total, items[0]?.unit)}`} onPress={send} loading={saving} testID="checkout-send" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  cartBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  size: { width: 64, borderWidth: 1.5, borderRadius: 10, paddingTop: 6, alignItems: 'center' },
  sizeInput: { width: '100%', textAlign: 'center', fontSize: 17, fontWeight: '600', paddingVertical: 6 },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
});
