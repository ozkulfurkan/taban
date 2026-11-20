import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { api } from '@/core/api';
import { useCanDelete, useCanWrite } from '@/core/auth';
import { confirm, notify } from '@/core/dialog';
import { formatDate, money } from '@/core/format';
import { balanceNote, ledgerBalance, type Employee, type LedgerEntry } from '@/core/personnel';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

// Personel detayı: bilgiler, bakiye, hesap hareketleri; maaş/avans/prim/kesinti girişi
export default function PersonelDetay() {
  const c = useTheme();
  const qc = useQueryClient();
  const canWrite = useCanWrite();
  const canDelete = useCanDelete();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<Employee & { ledger: LedgerEntry[] }>(`/api/personnel/${id}`);

  if (q.isLoading) return <><Stack.Screen options={{ title: 'Personel' }} /><Loading /></>;
  if (q.error || !q.data) return <><Stack.Screen options={{ title: 'Personel' }} /><ErrorState message={(q.error as Error)?.message || 'Personel bulunamadı'} onRetry={() => { void q.refetch(); }} /></>;
  const e = q.data;
  const balance = ledgerBalance(e.ledger);
  const rows = [...e.ledger].reverse().slice(0, 50);

  const setLeft = async () => {
    const leaving = e.status === 'active';
    if (!(await confirm(leaving ? 'İşten ayrıldı olarak işaretlensin mi?' : 'Tekrar çalışan yapılsın mı?', e.name, 'Evet'))) return;
    try {
      await api(`/api/personnel/${e.id}`, { method: 'PUT', body: { status: leaving ? 'left' : 'active' } });
      await qc.invalidateQueries();
    } catch (err: any) { notify('Kaydedilemedi', err?.message ?? ''); }
  };
  const remove = async () => {
    if (!(await confirm('Personel silinsin mi?', `${e.name} ve tüm hesap hareketleri kalıcı olarak silinir. Ayrılan personeli silmek yerine "İşten ayrıldı" işaretleyebilirsiniz.`, 'Sil', true))) return;
    try {
      await api(`/api/personnel/${e.id}`, { method: 'DELETE' });
      await qc.invalidateQueries();
      router.back();
    } catch (err: any) { notify('Silinemedi', err?.message ?? ''); }
  };

  return (
    <>
      <Stack.Screen options={{ title: e.name }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong }}>
          <T variant="small" color={c.strongText} style={{ opacity: 0.8 }}>Bakiye</T>
          <T variant="moneyLarge" color={c.strongText} testID="employee-balance">{money(balance, e.currency)}</T>
          <T variant="small" color={Math.abs(balance) < 0.005 ? c.strongText : balance > 0 ? c.strongNegative : c.strongPositive}>{balanceNote(balance)}</T>
        </Card>

        {canWrite ? (
          <View style={styles.actions}>
            <Button title="Ödeme / hakediş" icon="wallet" onPress={() => router.push(`/personel/hareket?id=${e.id}`)} style={styles.action} testID="employee-entry" />
            <Button title="Düzenle" icon="edit" variant="secondary" onPress={() => router.push(`/personel/form?id=${e.id}`)} style={styles.action} testID="employee-edit" />
            <Button title={e.status === 'active' ? 'İşten ayrıldı' : 'Tekrar çalışan'} variant="secondary" onPress={() => { void setLeft(); }} style={styles.action} testID="employee-status" />
            {canDelete ? <Button title="Sil" icon="trash" variant="ghost" onPress={() => { void remove(); }} style={styles.action} testID="employee-delete" /> : null}
          </View>
        ) : null}

        <Section title="Bilgiler">
          <Card style={{ padding: 0, gap: 0 }}>
            <ListRow title={`${e.department} · ${e.role}`} subtitle="Departman · görev" />
            <ListRow title={money(e.salary, e.currency)} subtitle={`Maaş · her ayın ${e.payday}. günü`} />
            <ListRow title={formatDate(e.hireDate)} subtitle={e.status === 'left' ? 'İşe giriş (ayrıldı)' : 'İşe giriş'} />
            {e.phone ? <ListRow title={e.phone} subtitle="Telefon" onPress={() => Linking.openURL(`tel:${e.phone!.replace(/\s/g, '')}`)} /> : null}
            {e.email ? <ListRow title={e.email} subtitle="E-posta" onPress={() => Linking.openURL(`mailto:${e.email}`)} /> : null}
          </Card>
        </Section>

        <Section title="Hesap hareketleri">
          <Card style={{ padding: 0, gap: 0 }}>
            {rows.length === 0 ? <View style={{ padding: 16 }}><T variant="small">Henüz hareket yok.</T></View> : rows.map(r => {
              const amount = r.credit - r.debit;
              return (
                <ListRow
                  key={r.id}
                  testID={`ledger-${r.id}`}
                  title={r.type}
                  subtitle={[formatDate(r.date), r.description && r.description !== r.type ? r.description : null, r.account].filter(Boolean).join(' · ')}
                  right={`${amount > 0 ? '+' : '−'}${money(Math.abs(amount), e.currency)}`}
                  rightColor={amount > 0 ? c.danger : c.success}
                />
              );
            })}
          </Card>
          <T variant="small">+ hakediş/prim (borcunuz artar) · − ödeme/kesinti (borcunuz azalır)</T>
        </Section>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: '40%' },
});
