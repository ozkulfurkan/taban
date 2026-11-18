import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { formatDate, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { daysToVade } from '@shared/cek';

type Dashboard = {
  dailyCiro: number; monthlyCiro: number; totalReceivables: number; totalPayables: number;
  assets: { kasa: number; pos: number; cek: number; stok: number };
  upcomingChecks: Array<{ id: string; borclu: string; tutar: number; currency: string; vadesi: string; customer?: { name: string } | null }>;
  negativeStock: { materials: unknown[]; products: unknown[] };
};

export default function Panel() {
  const c = useTheme();
  const { user } = useAuth();
  const q = useApi<Dashboard>('/api/dashboard');
  const companyName = user?.type === 'staff' ? user.companyName : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Panel' }} />
      {q.isLoading ? <Loading /> : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : (
        <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
          {companyName ? <T variant="small">{companyName}</T> : null}

          <View style={styles.grid}>
            <Stat label="Bugünkü satış" value={money(q.data!.dailyCiro)} />
            <Stat label="Bu ay satış" value={money(q.data!.monthlyCiro)} />
            <Stat label="Toplam alacak" value={money(q.data!.totalReceivables)} tone="success" />
            <Stat label="Toplam borç" value={money(q.data!.totalPayables)} tone="danger" />
          </View>
          <T variant="small">Döviz tutarları firmanın kayıtlı kuruyla TL karşılığına çevrilmiştir.</T>

          <Section title="Varlıklar">
            <Card style={{ padding: 0, gap: 0 }}>
              <ListRow title="Kasa" right={money(q.data!.assets.kasa)} />
              <ListRow title="Banka / POS" right={money(q.data!.assets.pos)} />
              <ListRow title="Portföydeki çekler" right={money(q.data!.assets.cek)} />
              <ListRow title="Stok değeri" right={money(q.data!.assets.stok)} />
            </Card>
          </Section>

          <Section title="Vadesi yaklaşan çekler (30 gün)">
            <Card style={{ padding: 0, gap: 0 }}>
              {q.data!.upcomingChecks.length === 0 ? (
                <View style={{ padding: 16 }}><T variant="small">Önümüzdeki 30 günde vadesi gelen çek yok.</T></View>
              ) : q.data!.upcomingChecks.map(ch => {
                const d = daysToVade(ch.vadesi);
                return (
                  <ListRow
                    key={ch.id}
                    title={ch.customer?.name || ch.borclu}
                    subtitle={`Vade ${formatDate(ch.vadesi)} · ${d === 0 ? 'bugün' : `${d} gün`}`}
                    right={money(ch.tutar, ch.currency)}
                    rightColor={d <= 7 ? c.warning : undefined}
                  />
                );
              })}
            </Card>
          </Section>

          {(q.data!.negativeStock.materials.length + q.data!.negativeStock.products.length) > 0 ? (
            <Card>
              <Badge label="Uyarı" tone="warning" />
              <T>
                {q.data!.negativeStock.materials.length + q.data!.negativeStock.products.length} kalemde stok eksiye düşmüş.
              </T>
            </Card>
          ) : null}
        </Screen>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const c = useTheme();
  const color = tone === 'success' ? c.success : tone === 'danger' ? c.danger : c.text;
  return (
    <Card style={styles.stat}>
      <T variant="small">{label}</T>
      <T variant="money" color={color} style={{ fontSize: 17 }} fit>{value}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 4 },
});
