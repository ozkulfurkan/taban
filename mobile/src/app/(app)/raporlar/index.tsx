import { Stack, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ErrorState, Loading, Screen, Section, T } from '@/components/ui';
import { formatDate, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { daysToVade } from '@shared/cek';

type Dashboard = {
  dailyCiro: number; monthlyCiro: number; totalReceivables: number; totalPayables: number;
  assets: { kasa: number; pos: number; cek: number; stok: number };
  upcomingChecks: { id: string; borclu: string; tutar: number; currency: string; vadesi: string; customer?: { name: string } | null }[];
};
type CekTotals = { totals: { currency: string; count: number; total: number }[] };

// Raporlar: alacak/borç, kasa-banka, çek portföyü ve vadesi yaklaşan/geçmiş çekler (TL karşılıkları firma kuruyla)
export default function Raporlar() {
  const c = useTheme();
  const d = useApi<Dashboard>('/api/dashboard');
  const portfoy = useApi<CekTotals>('/api/cek', { durum: 'PORTFOY' });
  const bankada = useApi<CekTotals>('/api/cek', { durum: 'BANKAYA_VERILDI' });
  const overdue = useApi<CekTotals>('/api/cek', { vade: 'overdue' });
  const refresh = () => { void d.refetch(); void portfoy.refetch(); void bankada.refetch(); void overdue.refetch(); };

  if (d.isLoading) return <><Stack.Screen options={{ title: 'Raporlar' }} /><Loading /></>;
  if (d.error || !d.data) return <><Stack.Screen options={{ title: 'Raporlar' }} /><ErrorState message={(d.error as Error)?.message || 'Rapor yüklenemedi'} onRetry={refresh} /></>;
  const r = d.data;
  const net = r.totalReceivables - r.totalPayables;
  const overdueCount = (overdue.data?.totals ?? []).reduce((s, t) => s + t.count, 0);

  return (
    <>
      <Stack.Screen options={{ title: 'Raporlar' }} />
      <Screen refreshing={d.isRefetching} onRefresh={refresh}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong, gap: 12 }} testID="report-balance">
          <View style={styles.row}>
            <Metric label="Toplam alacak" value={money(r.totalReceivables)} color={c.strongPositive} testID="report-receivables" />
            <Metric label="Toplam borç" value={money(r.totalPayables)} color={c.strongNegative} testID="report-payables" />
          </View>
          <View style={[styles.divider, { backgroundColor: c.strongText }]} />
          <Metric label="Net (alacak − borç)" value={money(net)} color={c.strongText} big />
          <T variant="small" color={c.strongText} style={{ opacity: 0.7 }}>Döviz bakiyeleri firma kuruyla TL karşılığına çevrilmiştir.</T>
        </Card>

        <Section title="Satış ve nakit">
          <Card style={{ gap: 12 }}>
            <View style={styles.row}>
              <Plain label="Bugünkü satış" value={money(r.dailyCiro)} />
              <Plain label="Bu ay satış" value={money(r.monthlyCiro)} />
            </View>
            <View style={styles.row}>
              <Plain label="Kasa + banka" value={money(r.assets.kasa + r.assets.pos)} onPress={() => router.push('/hesaplar')} />
              <Plain label="Stok değeri" value={money(r.assets.stok)} onPress={() => router.push('/stok')} />
            </View>
          </Card>
        </Section>

        <Section title="Çekler" action={<Pressable onPress={() => router.push('/cekler')} hitSlop={8}><T color={c.primary}>Tümü</T></Pressable>}>
          <Card style={{ gap: 12 }} testID="report-cheques">
            <View style={styles.row}>
              <Plain label="Portföydeki çekler (TL)" value={money(r.assets.cek)} />
              <Plain label="Vadesi geçmiş" value={`${overdueCount} çek`} color={overdueCount ? c.danger : undefined} onPress={() => router.push('/cekler')} />
            </View>
            <CurrencyTotals title="Portföyde" data={portfoy.data?.totals} />
            <CurrencyTotals title="Bankada (tahsilde)" data={bankada.data?.totals} />
          </Card>
        </Section>

        <Section title="Vadesi yaklaşan çekler (30 gün)">
          <Card style={{ padding: 0, gap: 0 }}>
            {r.upcomingChecks.length === 0 ? (
              <View style={{ padding: 16 }}><T variant="small">Önümüzdeki 30 günde vadesi gelen çek yok.</T></View>
            ) : r.upcomingChecks.map((ch, i) => {
              const days = daysToVade(ch.vadesi);
              return (
                <View key={ch.id} style={[styles.cekRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]} testID={`report-cek-${ch.id}`}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={{ fontWeight: '600' }} numberOfLines={1}>{ch.customer?.name || ch.borclu}</T>
                    <T variant="small" color={days <= 7 ? c.warning : undefined}>Vade {formatDate(ch.vadesi)} · {days === 0 ? 'bugün' : `${days} gün`}</T>
                  </View>
                  <T variant="money">{money(ch.tutar, ch.currency)}</T>
                </View>
              );
            })}
          </Card>
        </Section>
      </Screen>
    </>
  );
}

function Metric({ label, value, color, big, testID }: { label: string; value: string; color: string; big?: boolean; testID?: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>{label}</T>
      <T variant={big ? 'moneyLarge' : 'money'} color={color} fit testID={testID}>{value}</T>
    </View>
  );
}

function Plain({ label, value, color, onPress }: { label: string; value: string; color?: string; onPress?: () => void }) {
  const body = (
    <View style={{ gap: 2 }}>
      <T variant="small">{label}</T>
      <T variant="money" color={color} fit>{value}</T>
    </View>
  );
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body}
    </View>
  );
}

function CurrencyTotals({ title, data }: { title: string; data?: { currency: string; count: number; total: number }[] }) {
  if (!data?.length) return null;
  return (
    <View style={{ gap: 4 }}>
      <T variant="label">{title}</T>
      {data.map(t => (
        <View key={t.currency} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="small">{t.count} çek</T>
          <T variant="money">{money(t.total, t.currency)}</T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.3 },
  cekRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
