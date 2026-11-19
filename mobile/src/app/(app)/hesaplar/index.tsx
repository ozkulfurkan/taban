import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Empty, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { totalsByCurrency } from '@shared/cek';
import { money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

import type { Account } from '@/core/accounts';

// Kasa ve banka hesapları: türe göre gruplu, para birimine göre toplam
export default function Hesaplar() {
  const c = useTheme();
  const q = useApi<Account[]>('/api/accounts');
  const groups = useMemo(() => {
    const m = new Map<string, Account[]>();
    (q.data ?? []).forEach(a => { const k = a.type || 'Diğer'; m.set(k, [...(m.get(k) ?? []), a]); });
    return [...m.entries()];
  }, [q.data]);
  const totals = useMemo(() => totalsByCurrency((q.data ?? []).map(a => ({ tutar: a.balance, currency: a.currency }))), [q.data]);

  return (
    <>
      <Stack.Screen options={{ title: 'Kasa & Banka' }} />
      {q.isLoading ? <Loading /> : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
      ) : (
        <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
          {totals.length ? (
            <Card style={{ backgroundColor: c.strong, borderColor: c.strong, gap: 6 }}>
              <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>Toplam bakiye</T>
              {totals.map(t => (
                <T key={t.currency} variant="moneyLarge" color={c.strongText} fit testID={`accounts-total-${t.currency}`}>{money(t.total, t.currency)}</T>
              ))}
            </Card>
          ) : null}
          {groups.length === 0 ? <Empty message="Kasa / banka hesabı yok. Web uygulamasından ekleyebilirsiniz." /> : groups.map(([type, list]) => (
            <Section key={type} title={type}>
              <Card style={{ padding: 0, gap: 0 }}>
                {list.map(a => (
                  <View key={a.id} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: c.primarySoft }]}>
                      <Icon name={type.toLowerCase().includes('kasa') ? 'wallet' : 'bank'} size={18} color={c.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ListRow
                        title={a.name}
                        subtitle={a.currency}
                        right={money(a.balance, a.currency)}
                        rightColor={a.balance < 0 ? c.danger : c.text}
                        onPress={() => router.push(`/hesaplar/${a.id}`)}
                        testID={`account-${a.id}`}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            </Section>
          ))}
        </Screen>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
