import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { BellButton } from '@/components/notification-inbox';
import { OrderRow } from '@/components/portal-order-row';
import { Button, Card, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/core/auth';
import type { PortalOrder } from '@/core/portal';
import { useApi } from '@/core/query';
import { useUnreadCount } from '@/core/notifications-inbox';
import { useTheme } from '@/hooks/use-theme';

// Portal ana sayfası: sipariş özeti, yeni sipariş, son siparişler ve (firma açtıysa) hesap ekstresi
export default function PortalHome() {
  const c = useTheme();
  const { user } = useAuth();
  const fason = user?.type === 'portal' && user.portalType === 'SUBCONTRACTOR';
  const orders = useApi<PortalOrder[]>(fason ? null : '/api/portal/me/orders');
  const link = useApi<{ url: string | null }>(fason ? null : '/api/portal/me/statement-link');
  const unread = useUnreadCount();
  const list = orders.data ?? [];
  const active = list.filter(o => o.status !== 'SHIPPED' && o.status !== 'CANCELLED').length;
  const ready = list.filter(o => o.status === 'READY_FOR_SHIPMENT').length;
  const shipped = list.filter(o => o.status === 'SHIPPED').length;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => { void orders.refetch(); void link.refetch(); void unread.refetch(); }} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="small">Hoş geldiniz</T>
            <T variant="title" numberOfLines={1} testID="portal-name">{user?.name || user?.email}</T>
          </View>
          <BellButton href="/portal-bildirimler" unread={unread.data ?? 0} color={c.text} background={c.card} border={c.border} />
          <Pressable onPress={() => router.push('/portal-ayarlar')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ayarlar"
            style={[styles.round, { backgroundColor: c.card, borderColor: c.border }]} testID="portal-settings">
            <Icon name="settings" size={20} color={c.text} />
          </Pressable>
        </View>

        {fason ? (
          <Card>
            <T style={{ fontWeight: '600' }}>Fason portalı</T>
            <T variant="small">Fason siparişleri ve stoklar şimdilik web portalından (solecost.com/portal) takip ediliyor.</T>
          </Card>
        ) : (
          <>
            <Card style={{ backgroundColor: c.strong, borderColor: c.strong, flexDirection: 'row', gap: Spacing.three }} testID="portal-summary">
              <Stat label="Aktif sipariş" value={active} />
              <Stat label="Sevke hazır" value={ready} />
              <Stat label="Sevk edilen" value={shipped} />
            </Card>

            <Button title="Yeni sipariş" icon="plus" onPress={() => router.push('/portal-katalog')} testID="portal-new-order" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Siparişlerim" icon="doc" variant="secondary" onPress={() => router.push('/siparisler')} style={{ flex: 1 }} testID="portal-orders" />
              {link.data?.url ? (
                <Button title="Hesap ekstresi" icon="wallet" variant="secondary" style={{ flex: 1 }} testID="portal-statement"
                  onPress={() => { void WebBrowser.openBrowserAsync(link.data!.url!); }} />
              ) : null}
            </View>

            <View style={{ gap: Spacing.two }}>
              <View style={styles.sectionHead}>
                <T variant="label" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Son siparişler</T>
                {list.length > 5 ? (
                  <Pressable onPress={() => router.push('/siparisler')} hitSlop={8} accessibilityRole="link"><T color={c.primary}>Tümü</T></Pressable>
                ) : null}
              </View>
              <Card style={{ padding: 0, gap: 0 }}>
                {orders.isLoading ? <View style={{ padding: 16 }}><T variant="small">Yükleniyor…</T></View>
                  : list.length === 0 ? <View style={{ padding: 16 }}><T variant="small">Henüz siparişiniz yok. “Yeni sipariş” ile katalogdan sipariş verebilirsiniz.</T></View>
                  : list.slice(0, 5).map((o, i) => <OrderRow key={o.id} order={o} first={i === 0} />)}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <T variant="moneyLarge" color={c.strongText}>{value}</T>
      <T variant="small" color={c.strongText} style={{ opacity: 0.75 }} numberOfLines={1}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: 720, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
