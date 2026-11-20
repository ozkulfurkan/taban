import { router, type Href } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Card, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth, useCanWrite } from '@/core/auth';
import { useIsManager, useLinks } from '@/core/network';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

type Dashboard = {
  dailyCiro: number; monthlyCiro: number; totalReceivables: number; totalPayables: number;
  assets: { kasa: number; pos: number; cek: number; stok: number };
  upcomingChecks: { id: string; borclu: string; tutar: number; currency: string; vadesi: string; customer?: { name: string } | null }[];
  negativeStock: { materials: unknown[]; products: unknown[] };
};

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
type Tile = { label: string; icon: IconName; href: Href; tone: Tone; write?: boolean; page?: string; badge?: 'network'; testID: string };

// Ana menü: yeni modül eklemek / çıkarmak için bu listeyi düzenlemek yeterli
const TILES: Tile[] = [
  { label: 'Müşteriler', icon: 'people', href: '/cariler?kind=customer', tone: 'primary', testID: 'home-customers' },
  { label: 'Tedarikçiler', icon: 'truck', href: '/cariler?kind=supplier', tone: 'primary', testID: 'home-suppliers' },
  { label: 'Ürünler', icon: 'tag', href: '/urunler', tone: 'primary', testID: 'home-products' },
  { label: 'Katalog', icon: 'catalog', href: '/katalog', tone: 'success', testID: 'home-catalog' },
  { label: 'Satışlar', icon: 'doc', href: '/belgeler?tab=sale', tone: 'success', testID: 'home-sales' },
  { label: 'Alışlar', icon: 'cart', href: '/belgeler?tab=purchase', tone: 'warning', testID: 'home-purchases' },
  { label: 'İadeler', icon: 'undo', href: '/belgeler?tab=return', tone: 'danger', testID: 'home-returns' },
  { label: 'Çekler', icon: 'cheque', href: '/cekler', tone: 'success', testID: 'home-cekler' },
  { label: 'Kasa & Banka', icon: 'bank', href: '/hesaplar', tone: 'primary', testID: 'home-accounts' },
  { label: 'Stok', icon: 'box', href: '/stok', tone: 'warning', testID: 'home-stock' },
  { label: 'Siparişler', icon: 'orders', href: '/siparis', tone: 'primary', page: 'orders', testID: 'home-orders' },
  { label: 'Personel', icon: 'people', href: '/personel', tone: 'neutral', page: 'personnel', testID: 'home-personnel' },
  { label: 'Raporlar', icon: 'chart', href: '/raporlar', tone: 'success', page: 'dashboard', testID: 'home-reports' },
  { label: 'Firma Ağı', icon: 'link', href: '/baglantilar', tone: 'primary', badge: 'network', testID: 'home-network' },
  { label: 'Ayarlar', icon: 'settings', href: '/ayarlar', tone: 'neutral', testID: 'home-settings' },
];

export default function Home() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  // Panel izni olmayan kullanıcıda özet 403 döner; menü yine de çalışır
  const q = useApi<Dashboard>('/api/dashboard');
  const d = q.data;
  const companyName = user?.type === 'staff' ? user.companyName : null;
  const owner = user?.type === 'staff' && (user.role === 'ADMIN' || user.role === 'COMPANY_OWNER');
  const pages = user?.type === 'staff' ? user.allowedPages ?? [] : [];
  // Web'deki sayfa izinleriyle aynı: sahip her kutuyu, diğerleri izin verilen sayfaları görür
  const tiles = TILES.filter(t => (!t.write || canWrite) && (!t.page || owner || pages.includes(t.page)));
  const tones: Record<Tone, { fg: string; bg: string }> = {
    primary: { fg: c.primary, bg: c.primarySoft },
    success: { fg: c.success, bg: c.successSoft },
    warning: { fg: c.warning, bg: c.warningSoft },
    danger: { fg: c.danger, bg: c.dangerSoft },
    neutral: { fg: c.textSecondary, bg: c.border },
  };
  const negative = d ? d.negativeStock.materials.length + d.negativeStock.products.length : 0;
  // Onay bekleyen firma ağı istekleri (yalnızca onaylayabilecek kullanıcıya rozet)
  const manager = useIsManager();
  const links = useLinks(null, manager);
  const badges = { network: links.data?.asSeller.filter(l => l.status === 'PENDING').length ?? 0 };

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.six }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); if (manager) void links.refetch(); }} />}
      >
        {/* Bordo karşılama bandı: durum çubuğunun arkasına kadar uzanır */}
        <View style={[styles.hero, { backgroundColor: c.strong, paddingTop: insets.top + Spacing.three }]}>
          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="small" color={c.strongMuted}>{user?.name ? `Merhaba, ${user.name}` : 'Hoş geldiniz'}</T>
              <T variant="title" color={c.strongText} numberOfLines={1} testID="home-company">{companyName || 'SoleCost'}</T>
            </View>
            <Pressable onPress={() => router.push('/ayarlar')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ayarlar"
              style={[styles.round, { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' }]}>
              <Icon name="settings" size={20} color={c.strongText} />
            </Pressable>
          </View>
          <T variant="small" color={c.strongMuted}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        </View>

        <View style={styles.page}>
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
                style={({ pressed }) => [styles.tile, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
              >
                <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
                  <Icon name={t.icon} size={26} color={tone.fg} />
                </View>
                {t.badge && badges[t.badge] ? (
                  <View style={[styles.badge, { backgroundColor: c.danger }]} testID={`${t.testID}-badge`}>
                    <T color="#fff" style={{ fontSize: 12, fontWeight: '700' }}>{badges[t.badge]}</T>
                  </View>
                ) : null}
                <T style={styles.tileLabel} numberOfLines={2}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  page: { padding: Spacing.three, gap: Spacing.four, width: '100%', maxWidth: 720, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    // 3 sütun: (100% - 2 boşluk) / 3
    flexBasis: '30%', flexGrow: 1, maxWidth: '32%', aspectRatio: 1,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8,
    shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  tileIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
