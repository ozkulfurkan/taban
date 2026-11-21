import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Button, Empty, ErrorState, Loading, Segmented, T } from '@/components/ui';
import { useAuth, useCanWrite } from '@/core/auth';
import { notify } from '@/core/dialog';
import { formatDate } from '@/core/format';
import { printOrders, printProducts, shareOrdersPdf, shareProductsPdf } from '@/core/order-pdf';
import { formatQty, sizeSummary, stageLabel, statusTone, type PortalOrder } from '@/core/portal';
import { summarizeByProduct, type ProductSummary } from '@shared/order-summary';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

type Side = 'gelen' | 'verilen';
type Incoming = PortalOrder & {
  customer?: { id: string; name: string } | null;
  portalCustomer?: { email: string } | null;
  link?: { buyerCompany?: { name: string } | null } | null;
};
type Outgoing = PortalOrder & { link?: { sellerCompany: { name: string } } | null };

// Gelen: web "Gelen Siparişler" sekmeleri; Üretimde sekmesi kalıplama/boya/paketlemeyi de kapsar (sunucu)
const IN_TABS = [
  { key: 'ORDER_RECEIVED', label: 'Bekliyor' },
  { key: 'IN_PRODUCTION', label: 'Üretimde' },
  { key: 'READY_FOR_SHIPMENT', label: 'Hazır' },
  { key: 'SHIPPED', label: 'Sevk' },
  { key: 'CANCELLED', label: 'İptal' },
  { key: 'ALL', label: 'Tümü' },
] as const;
const OUT_TABS = [
  { key: 'active', label: 'Aktif' },
  { key: 'shipped', label: 'Sevk edilen' },
  { key: 'cancelled', label: 'İptal' },
  { key: 'all', label: 'Tümü' },
] as const;

// Siparişler: müşterilerden gelen (portal, bağlı SoleCost firmaları, elle) ve tedarikçilere verilen
export default function Siparisler() {
  const params = useLocalSearchParams<{ side?: Side }>();
  const [side, setSide] = useState<Side>(params.side === 'verilen' ? 'verilen' : 'gelen');
  return (
    <>
      <Stack.Screen options={{ title: 'Siparişler' }} />
      {side === 'gelen' ? <IncomingList header={<SideSwitch side={side} onChange={setSide} />} /> : <OutgoingList header={<SideSwitch side={side} onChange={setSide} />} />}
    </>
  );
}

function SideSwitch({ side, onChange }: { side: Side; onChange: (s: Side) => void }) {
  return <Segmented value={side} onChange={onChange} options={[{ value: 'gelen', label: 'Gelen' }, { value: 'verilen', label: 'Verilen' }]} />;
}

function Chips<K extends string>({ tabs, value, onChange }: { tabs: readonly { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const c = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {tabs.map(t => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} testID={`order-tab-${t.key}`}
            style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }]}>
            <T color={on ? c.primary : c.text} style={{ fontWeight: '600' }}>{t.label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function OrderRowView({ o, title, sub, onPress, testID }: { o: PortalOrder; title: string; sub: string; onPress: () => void; testID: string }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderBottomColor: c.border }, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T style={{ fontWeight: '600' }} numberOfLines={1}>{title}</T>
        <T variant="small" numberOfLines={1}>{sub}</T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <T variant="money">{formatQty(o.totalQuantity, o.unit)}</T>
        <Badge label={stageLabel(o)} tone={statusTone(o.status, o.confirmedAt)} />
      </View>
    </Pressable>
  );
}

/** Ürün bazlı satır: toplam miktar, sipariş/müşteri sayısı; dokununca beden toplamı ve siparişler */
function ProductRowView({ s, open, onToggle }: { s: ProductSummary; open: boolean; onToggle: () => void }) {
  const c = useTheme();
  const sizes = sizeSummary(s.sizeDistribution);
  return (
    <View style={{ backgroundColor: c.card, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} testID={`product-sum-${s.key}`}
        style={({ pressed }) => [styles.row, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T style={{ fontWeight: '600' }} numberOfLines={1}>{s.productCode ? `${s.productCode} · ` : ''}{s.productName || 'Ürün'}</T>
          <T variant="small" numberOfLines={1}>
            {s.orderCount} sipariş · {s.customers.length} müşteri{s.earliestDue ? ` · termin ${formatDate(s.earliestDue)}` : ''}
          </T>
        </View>
        <T variant="money">{formatQty(s.totalQuantity, s.unit)}</T>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}>
          {sizes ? <T variant="small">Bedenler: {sizes}</T> : null}
          {s.orders.map(o => (
            <Pressable key={o.orderNo} onPress={() => (o.id ? router.push(`/siparis/gelen/${o.id}`) : undefined)} accessibilityRole="link"
              style={({ pressed }) => [styles.subRow, { borderTopColor: c.border }, pressed && { opacity: 0.6 }]}>
              <T variant="small" style={{ flex: 1 }} numberOfLines={1}>{o.orderNo} · {o.customer || '—'}</T>
              <T variant="small" style={{ fontWeight: '600' }}>{formatQty(o.quantity, s.unit)}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function IncomingList({ header }: { header: React.ReactNode }) {
  const c = useTheme();
  const [tab, setTab] = useState<(typeof IN_TABS)[number]['key']>('ORDER_RECEIVED');
  const q = useApi<Incoming[]>('/api/orders', { status: tab, from: '2000-01-01' });
  const canWrite = useCanWrite();
  const { user } = useAuth();
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null);
  // Görünüm: sipariş sipariş ya da ürün bazında (hangi üründen toplam ne kadar)
  const [view, setView] = useState<'order' | 'product'>('order');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const summary = useMemo(() => (view === 'product' ? summarizeByProduct(rows) : []), [rows, view]);
  // Sekmedeki siparişlerin föyü: "Bekleyen siparişler", "Üretimdeki siparişler"...
  const tabLabel = IN_TABS.find(t => t.key === tab)?.label ?? '';
  const baseTitle = tab === 'ALL' ? 'Siparişler' : tab === 'ORDER_RECEIVED' ? 'Bekleyen siparişler' : `${tabLabel} siparişler`;
  const listTitle = view === 'product' ? `${baseTitle} — ürün bazında` : baseTitle;
  const output = async (kind: 'pdf' | 'print') => {
    setBusy(kind);
    try {
      const opts = { title: listTitle, companyName: user?.type === 'staff' ? user.companyName : null };
      if (view === 'product') {
        if (kind === 'pdf') await shareProductsPdf(summary, opts); else await printProducts(summary, opts);
      } else if (kind === 'pdf') await shareOrdersPdf(rows, opts); else await printOrders(rows, opts);
    } catch (e: any) {
      notify(kind === 'pdf' ? 'PDF oluşturulamadı' : 'Yazdırılamadı', e?.message ?? '');
    } finally {
      setBusy(null);
    }
  };
  const data: (Incoming | ProductSummary)[] = q.isLoading || q.error ? [] : view === 'product' ? summary : rows;
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      data={data}
      keyExtractor={x => ('key' in x ? `p-${x.key}` : x.id)}
      ListHeaderComponent={(
        <View style={{ padding: 16, gap: 12 }}>
          {header}
          {canWrite ? (
            <Button title="Yeni sipariş" icon="plus" onPress={() => router.push('/siparis/yeni')} testID="order-new" />
          ) : null}
          <Chips tabs={IN_TABS} value={tab} onChange={setTab} />
          <Segmented value={view} onChange={v => { setView(v); setOpen(null); }}
            options={[{ value: 'order', label: 'Sipariş' }, { value: 'product', label: 'Ürün bazında' }]} />
          {rows.length ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title={`PDF (${rows.length})`} icon="pdf" variant="secondary" style={{ flex: 1 }} loading={busy === 'pdf'}
                disabled={!!busy} onPress={() => { void output('pdf'); }} testID="orders-pdf" />
              <Button title="Yazdır" icon="doc" variant="secondary" style={{ flex: 1 }} loading={busy === 'print'}
                disabled={!!busy} onPress={() => { void output('print'); }} testID="orders-print" />
            </View>
          ) : null}
        </View>
      )}
      ListEmptyComponent={q.isLoading ? <Loading /> : q.error
        ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
        : <Empty message="Bu sekmede sipariş yok." />}
      renderItem={({ item }) => {
        if ('key' in item) {
          return <ProductRowView s={item} open={open === item.key} onToggle={() => setOpen(k => (k === item.key ? null : item.key))} />;
        }
        const o = item;
        const source = o.link ? `SoleCost · ${o.link.buyerCompany?.name ?? ''}` : o.portalCustomer ? 'Portal' : '';
        return (
          <OrderRowView
            o={o}
            testID={`in-order-${o.id}`}
            title={`${o.orderNo} · ${o.customer?.name ?? '—'}`}
            sub={[formatDate(o.createdAt), source].filter(Boolean).join(' · ')}
            onPress={() => router.push(`/siparis/gelen/${o.id}`)}
          />
        );
      }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
    />
  );
}

function OutgoingList({ header }: { header: React.ReactNode }) {
  const c = useTheme();
  const [tab, setTab] = useState<(typeof OUT_TABS)[number]['key']>('active');
  const q = useApi<Outgoing[]>('/api/network/orders');
  const rows = (q.data ?? []).filter(o => tab === 'all' ? true : tab === 'shipped' ? o.status === 'SHIPPED'
    : tab === 'cancelled' ? o.status === 'CANCELLED' : o.status !== 'SHIPPED' && o.status !== 'CANCELLED');
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      data={q.isLoading || q.error ? [] : rows}
      keyExtractor={o => o.id}
      ListHeaderComponent={(
        <View style={{ padding: 16, gap: 12 }}>
          {header}
          <Chips tabs={OUT_TABS} value={tab} onChange={setTab} />
          <T variant="small">Yeni sipariş için bağlı tedarikçinin sayfasındaki &quot;Sipariş ver&quot; düğmesini kullanın.</T>
        </View>
      )}
      ListEmptyComponent={q.isLoading ? <Loading /> : q.error
        ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
        : <Empty message="Bu sekmede sipariş yok." />}
      renderItem={({ item: o }) => (
        <OrderRowView
          o={o}
          testID={`out-order-${o.id}`}
          title={`${o.orderNo} · ${o.link?.sellerCompany.name ?? '—'}`}
          sub={formatDate(o.createdAt)}
          onPress={() => router.push(`/siparis/verilen/${o.id}`)}
        />
      )}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
    />
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
