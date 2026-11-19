import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/core/api';
import { useCanDelete, useCanWrite } from '@/core/auth';
import { confirm, notify } from '@/core/dialog';
import { formatDate, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useLinkSheet } from '@/components/link-sheet';
import type { PartyKind } from '@/core/statement';
import { useTheme } from '@/hooks/use-theme';

type Doc = { id: string; invoiceNo: string | null; date: string; total: number; currency?: string | null; isReturn?: boolean; status?: string };
type Payment = { id: string; date: string; amount: number; method?: string | null; notes?: string | null; currency?: string | null };
// Cari detay API'si: müşteride satışlar (invoices) ve iadeler (returns) ayrı, tedarikçide alışlar iadeleriyle birlikte (purchases)
type Party = {
  id: string; name: string; currency: string; phone?: string | null; email?: string | null; address?: string | null; balance: number;
  invoices?: Doc[]; returns?: Doc[]; purchases?: Doc[]; payments?: Payment[];
};
type ListKey = 'docs' | 'returns' | 'payments';

export default function PartyDetail() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const { kind, id } = useLocalSearchParams<{ kind: PartyKind; id: string }>();
  const k: PartyKind = kind === 'supplier' ? 'supplier' : 'customer';
  const party = useApi<Party>(`/api/${k === 'customer' ? 'customers' : 'suppliers'}/${id}`);
  const linkSheet = useLinkSheet(k, id, party.data?.name ?? '', canWrite);
  const canDelete = useCanDelete();
  const qc = useQueryClient();
  // Tedarikçi SoleCost'ta bağlıysa (onaylı bağlantı) buradan sipariş verilebilir
  const links = useApi<{ asBuyer: { id: string; status: string; sellerCompany: { name: string } }[] }>(k === 'supplier' ? '/api/network/links' : null, { supplierId: id });
  const activeLink = links.data?.asBuyer.find(l => l.status === 'ACTIVE');
  const archive = async () => {
    const what = k === 'customer' ? 'Müşteri' : 'Tedarikçi';
    if (!(await confirm(`${what} silinsin mi?`, `"${party.data?.name}" listelerden kaldırılır. Belgeleri ve ödemeleri silinmez; ekstrede görünmeye devam eder.`, 'Sil', true))) return;
    try {
      await api(`/api/${k === 'customer' ? 'customers' : 'suppliers'}/${id}`, { method: 'DELETE' });
      await qc.invalidateQueries();
      router.back();
      notify(`${what} silindi`, party.data?.name ?? '');
    } catch (e: any) { notify('Silinemedi', e?.message ?? ''); }
  };
  const [list, setList] = useState<ListKey | null>(null);

  if (party.isLoading) return <><Stack.Screen options={{ title: k === 'customer' ? 'Müşteri' : 'Tedarikçi' }} /><Loading /></>;
  if (party.error || !party.data) return <><Stack.Screen options={{ title: k === 'customer' ? 'Müşteri' : 'Tedarikçi' }} /><ErrorState message={(party.error as Error)?.message || 'Cari bulunamadı'} onRetry={() => party.refetch()} /></>;
  const p = party.data;
  const cur = p.currency || 'TRY';
  const docs = k === 'customer' ? (p.invoices ?? []) : (p.purchases ?? []).filter(d => !d.isReturn);
  const returns = k === 'customer' ? (p.returns ?? []) : (p.purchases ?? []).filter(d => d.isReturn);
  const payments = p.payments ?? [];
  const docPath = k === 'customer' ? 'satis' : 'alis';
  const lists: { key: ListKey; label: string; count: number }[] = [
    { key: 'docs', label: k === 'customer' ? 'Satışlar' : 'Alışlar', count: docs.length },
    { key: 'returns', label: 'İadeler', count: returns.length },
    { key: 'payments', label: 'Ödemeler', count: payments.length },
  ];
  const settled = Math.abs(p.balance) < 0.005;
  const positiveIsGood = k === 'customer';
  const balanceNote = settled ? 'Hesap kapalı'
    : k === 'customer' ? (p.balance > 0 ? 'Müşteriden alacağınız' : 'Müşteriye borcunuz')
    : (p.balance > 0 ? 'Tedarikçiye borcunuz' : 'Tedarikçiden alacağınız');

  return (
    <>
      <Stack.Screen options={{ title: p.name }} />
      <Screen refreshing={party.isRefetching} onRefresh={() => { void party.refetch(); }}>
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
              onPress={() => router.push(`/cariler/${k}/${id}/yeni`)}
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
          {canWrite && activeLink ? (
            <Button title="Sipariş ver" icon="cart" variant="secondary" style={styles.action} testID="party-network-order"
              onPress={() => router.push(`/siparis/ver?linkId=${activeLink.id}&name=${encodeURIComponent(activeLink.sellerCompany.name)}`)} />
          ) : null}
          {canWrite ? (
            <Button title="Düzenle" icon="edit" variant="secondary" style={styles.action} testID="party-edit"
              onPress={() => router.push(`/cariler/${k}/form?id=${id}`)} />
          ) : null}
          {canDelete ? (
            <Button title="Sil" icon="trash" variant="ghost" style={styles.action} testID="party-delete" onPress={() => { void archive(); }} />
          ) : null}
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

        {/* Satış/alış, iade ve ödemeler ayrı listelenir; hepsi bir arada yalnızca ekstrede */}
        <View style={styles.lists}>
          {lists.map(l => (
            <Button
              key={l.key}
              title={l.count ? `${l.label} ${l.count}` : l.label}
              variant={list === l.key ? 'primary' : 'secondary'}
              onPress={() => setList(v => (v === l.key ? null : l.key))}
              style={{ flex: 1 }}
              testID={`party-list-${l.key}`}
            />
          ))}
        </View>

        {list ? (
          <Card style={{ padding: 0, gap: 0 }}>
            {list === 'payments' ? (
              payments.length === 0 ? <Empty text="Ödeme kaydı yok." /> : payments.map(pm => (
                <ListRow
                  key={pm.id}
                  title={pm.method || 'Ödeme'}
                  subtitle={[formatDate(pm.date), pm.notes].filter(Boolean).join(' · ')}
                  right={money(pm.amount, pm.currency || cur)}
                />
              ))
            ) : (() => {
              const rows = list === 'docs' ? docs : returns;
              if (rows.length === 0) return <Empty text={list === 'returns' ? 'İade kaydı yok.' : k === 'customer' ? 'Satış kaydı yok.' : 'Alış kaydı yok.'} />;
              return rows.map(d => (
                <ListRow
                  key={d.id}
                  title={d.invoiceNo || (k === 'customer' ? 'Fatura' : 'Alış')}
                  subtitle={formatDate(d.date)}
                  right={money(Math.abs(d.total), d.currency || cur)}
                  onPress={() => router.push(`/cariler/${docPath}/${d.id}`)}
                />
              ));
            })()}
          </Card>
        ) : null}
      </Screen>
      {linkSheet.sheet}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={{ padding: 16 }}><T variant="small">{text}</T></View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: '40%' },
  lists: { flexDirection: 'row', gap: 8 },
});
