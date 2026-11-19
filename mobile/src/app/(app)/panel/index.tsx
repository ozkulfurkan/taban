import { router, type Href } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Card, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth, useCanWrite } from '@/core/auth';
import { formatDate, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { daysToVade } from '@shared/cek';

type Dashboard = {
  dailyCiro: number; monthlyCiro: number; totalReceivables: number; totalPayables: number;
  assets: { kasa: number; pos: number; cek: number; stok: number };
  upcomingChecks: { id: string; borclu: string; tutar: number; currency: string; vadesi: string; customer?: { name: string } | null }[];
  negativeStock: { materials: unknown[]; products: unknown[] };
};

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
type Tile = { label: string; icon: IconName; href: Href; tone: Tone; write?: boolean; testID: string };

// Ana menü: yeni modül eklemek / çıkarmak için bu listeyi düzenlemek yeterli
const TILES: Tile[] = [
  { label: 'Müşteriler', icon: 'people', href: '/cariler?kind=customer', tone: 'primary', testID: 'home-customers' },
  { label: 'Tedarikçiler', icon: 'truck', href: '/cariler?kind=supplier', tone: 'primary', testID: 'home-suppliers' },
  { label: 'Yeni Satış', icon: 'newDoc', href: '/belgeler/yeni?kind=sale', tone: 'success', write: true, testID: 'home-new-sale' },
  { label: 'Satışlar', icon: 'doc', href: '/belgeler?tab=sale', tone: 'success', testID: 'home-sales' },
  { label: 'Alışlar', icon: 'cart', href: '/belgeler?tab=purchase', tone: 'warning', testID: 'home-purchases' },
  { label: 'İadeler', icon: 'undo', href: '/belgeler?tab=return', tone: 'danger', testID: 'home-returns' },
  { label: 'Çekler', icon: 'cheque', href: '/cekler', tone: 'success', testID: 'home-cekler' },
  { label: 'Kasa & Banka', icon: 'bank', href: '/hesaplar', tone: 'primary', testID: 'home-accounts' },
  { label: 'Stok', icon: 'box', href: '/stok', tone: 'warning', testID: 'home-stock' },
  { label: 'Ayarlar', icon: 'settings', href: '/ayarlar', tone: 'neutral', testID: 'home-settings' },
];

export default function Home() {
  const c = useTheme();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  // Panel izni olmayan kullanıcıda özet 403 döner; menü yine de çalışır
  const q = useApi<Dashboard>('/api/dashboard');
  const d = q.data;
  const companyName = user?.type === 'staff' ? user.companyName : null;
  const tiles = TILES.filter(t => !t.write || canWrite);
  const tones: Record<Tone, { fg: string; bg: string }> = {
    primary: { fg: c.primary, bg: c.primarySoft },
    success: { fg: c.success, bg: c.successSoft },
    warning: { fg: c.warning, bg: c.warningSoft },
    danger: { fg: c.danger, bg: c.dangerSoft },
    neutral: { fg: c.textSecondary, bg: c.border },
  };
  const negative = d ? d.negativeStock.materials.length + d.negativeStock.products.length : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="small">{user?.name ? `Merhaba, ${user.name}` : 'Hoş geldiniz'}</T>
            <T variant="title" numberOfLines={1} testID="home-company">{companyName || 'SoleCost'}</T>
          </View>
          <Pressable onPress={() => router.push('/ayarlar')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ayarlar"
            style={[styles.round, { backgroundColor: c.card, borderColor: c.border }]}>
            <Icon name="settings" size={20} color={c.text} />
          </Pressable>
        </View>

        {d ? (
          <Card style={{ backgroundColor: c.strong, borderColor: c.strong, gap: Spacing.three }} testID="home-summary">
            <View>
              <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>Toplam alacak</T>
              <T variant="moneyLarge" color={c.strongText} fit>{money(d.totalReceivables)}</T>
            </View>
            <View style={styles.summaryRow}>
              <Summary label="Bu ay satış" value={money(d.monthlyCiro)} />
              <Summary label="Toplam borç" value={money(d.totalPayables)} />
              <Summary label="Kasa + banka" value={money(d.assets.kasa + d.assets.pos)} />
            </View>
          </Card>
        ) : null}

        <View style={styles.grid}>
          {tiles.map(t => {
            const tone = tones[t.tone];
            return (
              <Pressable
                key={t.label}
                onPress={() => router.push(t.href)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                testID={t.testID}
                style={({ pressed }) => [styles.tile, { backgroundColor: c.card, borderColor: c.border }, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
              >
                <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
                  <Icon name={t.icon} size={26} color={tone.fg} />
                </View>
                <T style={styles.tileLabel} numberOfLines={2}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>

        {d && d.upcomingChecks.length ? (
          <View style={{ gap: Spacing.two }}>
            <View style={styles.sectionHead}>
              <T variant="label" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Vadesi yaklaşan çekler</T>
              <Pressable onPress={() => router.push('/cekler')} hitSlop={8} accessibilityRole="link"><T color={c.primary}>Tümü</T></Pressable>
            </View>
            <Card style={{ padding: 0, gap: 0 }}>
              {d.upcomingChecks.slice(0, 5).map((ch, i) => {
                const days = daysToVade(ch.vadesi);
                return (
                  <View key={ch.id} style={[styles.cekRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={{ fontWeight: '600' }} numberOfLines={1}>{ch.customer?.name || ch.borclu}</T>
                      <T variant="small" color={days <= 7 ? c.warning : undefined}>
                        Vade {formatDate(ch.vadesi)} · {days === 0 ? 'bugün' : `${days} gün`}
                      </T>
                    </View>
                    <T variant="money">{money(ch.tutar, ch.currency)}</T>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {negative > 0 ? (
          <Card
            onPress={() => router.push(d?.negativeStock.products.length ? '/stok?negative=1' : '/stok?kind=material&negative=1')}
            testID="home-negative-stock"
            style={{ backgroundColor: c.warningSoft, borderColor: c.warningSoft, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Icon name="alert" color={c.warning} />
            <T style={{ flex: 1 }}>{negative} kalemde stok eksiye düşmüş.</T>
            <Icon name="chevron" size={14} color={c.warning} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <T variant="small" color={c.strongText} style={{ opacity: 0.75 }} numberOfLines={1}>{label}</T>
      <T variant="money" color={c.strongText} fit style={{ fontSize: 14 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: 720, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: 'row', gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    // 3 sütun: (100% - 2 boşluk) / 3
    flexBasis: '30%', flexGrow: 1, maxWidth: '32%', aspectRatio: 1,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8,
  },
  tileIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cekRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
