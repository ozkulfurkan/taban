import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { useCanWrite } from '@/core/auth';
import { formatDate, isoDay, money, yearAgo } from '@/core/format';
import { useApi } from '@/core/query';
import { useLinkSheet } from '@/components/link-sheet';
import { useStatement, type PartyKind } from '@/core/statement';
import { useTheme } from '@/hooks/use-theme';

type Party = { id: string; name: string; currency: string; phone?: string | null; email?: string | null; address?: string | null; balance: number };

export default function PartyDetail() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const { kind, id } = useLocalSearchParams<{ kind: PartyKind; id: string }>();
  const k: PartyKind = kind === 'supplier' ? 'supplier' : 'customer';
  const party = useApi<Party>(`/api/${k === 'customer' ? 'customers' : 'suppliers'}/${id}`);
  const st = useStatement(k, id, yearAgo(), isoDay());
  const linkSheet = useLinkSheet(k, id, party.data?.name ?? '', canWrite);

  if (party.isLoading) return <Loading />;
  if (party.error || !party.data) return <ErrorState message={(party.error as Error)?.message || 'Cari bulunamadı'} onRetry={() => party.refetch()} />;
  const p = party.data;
  const cur = p.currency || 'TRY';
  const recent = (st.result?.rows ?? []).filter(r => !r.isSubRow).slice(-8).reverse();
  const settled = Math.abs(p.balance) < 0.005;
  const positiveIsGood = k === 'customer';
  const balanceNote = settled ? 'Hesap kapalı'
    : k === 'customer' ? (p.balance > 0 ? 'Müşteriden alacağınız' : 'Müşteriye borcunuz')
    : (p.balance > 0 ? 'Tedarikçiye borcunuz' : 'Tedarikçiden alacağınız');

  return (
    <>
      <Stack.Screen options={{ title: p.name, headerLargeTitle: false }} />
      <Screen refreshing={party.isRefetching} onRefresh={() => { void party.refetch(); void st.refetch(); }}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong }}>
          <T variant="small" color={c.strongText} style={{ opacity: 0.8 }}>Bakiye</T>
          <T variant="moneyLarge" color={c.strongText} testID="party-balance">{money(p.balance, cur)}</T>
          <T variant="small" color={settled ? c.strongText : (p.balance > 0) === positiveIsGood ? '#6EE7B7' : '#FCA5A5'}>{balanceNote}</T>
        </Card>

        <View style={styles.actions}>
          {canWrite ? (
            <Button
              title={k === 'customer' ? 'Tahsilat' : 'Ödeme'}
              icon={k === 'customer' ? 'arrowDown' : 'arrowUp'}
              onPress={() => router.push(`/cariler/${k}/${id}/hareket`)}
              style={styles.action}
              testID="party-payment"
            />
          ) : null}
          {canWrite ? (
            <Button
              title={k === 'customer' ? 'Satış' : 'Alış'}
              icon="plus"
              variant="secondary"
              onPress={() => router.push(`/belgeler/yeni?kind=${k === 'customer' ? 'sale' : 'purchase'}&partyId=${id}`)}
              style={styles.action}
              testID="party-new-doc"
            />
          ) : null}
          {canWrite && k === 'customer' ? (
            <Button
              title="Çek al"
              icon="cheque"
              variant="secondary"
              onPress={() => router.push(`/cekler/yeni?customerId=${id}`)}
              style={styles.action}
              testID="party-new-cek"
            />
          ) : null}
          <Button title="Ekstre" icon="doc" variant="secondary" onPress={() => router.push(`/cariler/${k}/${id}/ekstre`)} style={styles.action} />
          <Button title="Link Gönder" icon="link" variant="secondary" onPress={linkSheet.open} loading={linkSheet.busy} style={styles.action} testID="party-link" />
        </View>

        {(p.phone || p.email || p.address) ? (
          <Section title="İletişim">
            <Card style={{ padding: 0, gap: 0 }}>
              {p.phone ? <ListRow title={p.phone} subtitle="Telefon" onPress={() => Linking.openURL(`tel:${p.phone!.replace(/\s/g, '')}`)} /> : null}
              {p.email ? <ListRow title={p.email} subtitle="E-posta" onPress={() => Linking.openURL(`mailto:${p.email}`)} /> : null}
              {p.address ? <ListRow title={p.address} subtitle="Adres" /> : null}
            </Card>
          </Section>
        ) : null}

        <Section title="Son hareketler">
          <Card style={{ padding: 0, gap: 0 }}>
            {st.isLoading ? <Loading /> : recent.length === 0 ? (
              <View style={{ padding: 16 }}><T variant="small">Son 12 ayda hareket yok.</T></View>
            ) : recent.map(r => (
              <ListRow
                key={r.id}
                title={`${r.hareket}${r.belgeNo ? ` · ${r.belgeNo}` : ''}`}
                subtitle={formatDate(r.date)}
                right={r.borc > 0 ? money(r.borc, cur) : `−${money(r.alacak, cur)}`}
                rightColor={r.borc > 0 ? c.text : c.success}
              />
            ))}
          </Card>
        </Section>
      </Screen>
      {linkSheet.sheet}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: '40%' },
});
