import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Empty, ErrorState, Loading, Screen, Segmented, T } from '@/components/ui';
import { api } from '@/core/api';
import { useCanWrite } from '@/core/auth';
import { confirm, notify } from '@/core/dialog';
import { formatDate, isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import type { Account } from '@/core/accounts';

type Movement = {
  id: string; date: string; createdAt: string; type: 'RECEIVED' | 'PAID'; amount: number; originalAmount?: number | null;
  method?: string | null; notes?: string | null; customer?: { id: string; name: string } | null; supplier?: { id: string; name: string } | null;
};
type Range = '1' | '3' | '12' | 'all';

function rangeFrom(r: Range) {
  if (r === 'all') return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - Number(r));
  return isoDay(d);
}

// Web ile aynı etiket: giriş/çıkış/transfer; carili hareketler tahsilat/ödeme
function label(m: Movement) {
  if (m.method === 'Para Girişi' || m.method === 'Para Çıkışı' || m.method === 'Transfer') return m.method;
  if (m.customer) return 'Tahsilat';
  if (m.supplier) return 'Ödeme';
  return m.method || 'İşlem';
}

export default function AccountDetail() {
  const c = useTheme();
  const qc = useQueryClient();
  const canWrite = useCanWrite();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [range, setRange] = useState<Range>('1');
  const from = rangeFrom(range);
  const q = useApi<{ account: Account; payments: Movement[] }>(`/api/accounts/${id}/ekstre`, { from });

  // Bakiye web ile aynı hesaplanır: dönem öncesi bakiye = güncel bakiye − dönemdeki hareketler
  const rows = useMemo(() => {
    if (!q.data) return [];
    const amt = (m: Movement) => m.originalAmount ?? m.amount;
    const sorted = [...q.data.payments].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let balance = q.data.account.balance - sorted.reduce((s, m) => s + (m.type === 'RECEIVED' ? amt(m) : -amt(m)), 0);
    return sorted.map(m => {
      balance += m.type === 'RECEIVED' ? amt(m) : -amt(m);
      return { ...m, shown: amt(m), running: balance };
    }).reverse();
  }, [q.data]);

  if (q.isLoading) return <><Stack.Screen options={{ title: 'Hesap' }} /><Loading /></>;
  if (q.error || !q.data) return <><Stack.Screen options={{ title: 'Hesap' }} /><ErrorState message={(q.error as Error)?.message || 'Hesap bulunamadı'} onRetry={() => { void q.refetch(); }} /></>;
  const a = q.data.account;
  const go = (type: 'giris' | 'cikis' | 'transfer') => router.push(`/hesaplar/islem?id=${a.id}&type=${type}`);

  const remove = async (m: Movement) => {
    if (m.customer || m.supplier) {
      notify('Bu hareket cariye bağlı', 'Tahsilat ve ödemeleri web uygulamasından silin.');
      return;
    }
    // Transfer iki hesapta ayrı kayıt olarak durur; tek tarafını silmek diğer hesabı bozar
    if (m.method === 'Transfer') {
      notify('Transfer silinemez', 'Transfer iki hesaba birden kayıtlıdır. Web uygulamasından iki kaydı birlikte silin.');
      return;
    }
    if (!(await confirm('Hareket silinsin mi?', `${label(m)} · ${money(m.originalAmount ?? m.amount, a.currency)}`, 'Sil', true))) return;
    try {
      await api(`/api/payments/${m.id}`, { method: 'DELETE' });
      await qc.invalidateQueries();
    } catch (e: any) {
      notify('Silinemedi', e?.message || '');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: a.name }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong }}>
          <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>{a.type} · {a.currency}</T>
          <T variant="moneyLarge" color={c.strongText} fit testID="account-balance">{money(a.balance, a.currency)}</T>
        </Card>

        {canWrite ? (
          <View style={styles.actions}>
            <Button title="Para girişi" icon="arrowDown" onPress={() => go('giris')} style={{ flex: 1 }} testID="account-in" />
            <Button title="Para çıkışı" icon="arrowUp" variant="secondary" onPress={() => go('cikis')} style={{ flex: 1 }} testID="account-out" />
            <Button title="Transfer" icon="transfer" variant="secondary" onPress={() => go('transfer')} style={{ flex: 1 }} testID="account-transfer" />
          </View>
        ) : null}

        <Segmented value={range} onChange={setRange}
          options={[{ value: '1', label: '1 ay' }, { value: '3', label: '3 ay' }, { value: '12', label: '12 ay' }, { value: 'all', label: 'Tümü' }]} />

        {rows.length === 0 ? <Empty message="Bu dönemde hareket yok." /> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {rows.map((m, i) => {
              const incoming = m.type === 'RECEIVED';
              const party = m.customer?.name || m.supplier?.name;
              return (
                <Pressable
                  key={m.id}
                  onLongPress={canWrite ? () => { void remove(m); } : undefined}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
                  testID={`movement-${m.id}`}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T style={{ fontWeight: '600' }} numberOfLines={1}>{label(m)}{party ? ` · ${party}` : ''}</T>
                    <T variant="small" numberOfLines={2}>{formatDate(m.date)}{m.notes ? ` · ${m.notes}` : ''}</T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <T variant="money" color={incoming ? c.success : c.danger}>{incoming ? '+' : '−'}{money(m.shown, a.currency)}</T>
                    <T variant="small">Bakiye {money(m.running, a.currency)}</T>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}
        {canWrite && rows.length ? <T variant="small" style={{ textAlign: 'center' }}>Silmek için harekete basılı tutun.</T> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
