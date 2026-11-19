import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Picker } from '@/components/picker';
import { Badge, Button, Card, Empty, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { api } from '@/core/api';
import { confirm, notify } from '@/core/dialog';
import { formatDate } from '@/core/format';
import { LINK_STATUS, useIsManager, useLinks, type SellerLink } from '@/core/network';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

// Firma ağı: kendi firma kodumuz, gelen bağlantı istekleri (onay / red) ve bağlı firmalar
export default function Network() {
  const c = useTheme();
  const qc = useQueryClient();
  const manager = useIsManager();
  const code = useApi<{ code: string }>('/api/network/code');
  const links = useLinks();
  const [matching, setMatching] = useState<SellerLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const customers = useApi<{ id: string; name: string; currency?: string }[]>(matching ? '/api/customers' : null, { minimal: 'true' });

  if (links.isLoading) return <><Stack.Screen options={{ title: 'Firma Ağı' }} /><Loading /></>;
  if (links.error || !links.data) {
    return <><Stack.Screen options={{ title: 'Firma Ağı' }} /><ErrorState message={(links.error as Error)?.message || 'Yüklenemedi'} onRetry={() => { void links.refetch(); }} /></>;
  }
  const pending = links.data.asSeller.filter(l => l.status === 'PENDING');
  const activeCustomers = links.data.asSeller.filter(l => l.status === 'ACTIVE');
  const suppliers = links.data.asBuyer;
  const myCode = code.data?.code;

  const share = () => {
    if (!myCode) return;
    void Share.share({ message: `SoleCost firma kodumuz: ${myCode}\nTedarikçi eklerken bu kodu girerek bizden SoleCost üzerinden sipariş verebilirsiniz.` });
  };

  // Onay: yeni müşteri kaydı açılır ya da mevcut müşteriyle eşleştirilir (alıcının siparişleri o müşteriye düşer)
  const approve = async (l: SellerLink, customerId?: string) => {
    setBusy(l.id);
    try {
      await api(`/api/network/links/${l.id}/approve`, { method: 'POST', body: customerId ? { customerId } : { createCustomer: true } });
      await qc.invalidateQueries();
      notify('Bağlantı onaylandı', `${l.buyerCompany.name} artık size sipariş verebilir.`);
    } catch (e: any) {
      notify('Onaylanamadı', e?.message ?? '');
    } finally {
      setBusy(null);
    }
  };
  const reject = async (l: SellerLink) => {
    if (!(await confirm('İstek reddedilsin mi?', `${l.buyerCompany.name} size sipariş veremez. Daha sonra yeniden istek gönderebilir.`, 'Reddet', true))) return;
    setBusy(l.id);
    try {
      await api(`/api/network/links/${l.id}/reject`, { method: 'POST' });
      await qc.invalidateQueries();
    } catch (e: any) {
      notify('Reddedilemedi', e?.message ?? '');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Firma Ağı' }} />
      <Screen refreshing={links.isRefetching} onRefresh={() => { void links.refetch(); void code.refetch(); }}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong, gap: 8 }}>
          <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>Firma kodunuz</T>
          <T variant="moneyLarge" color={c.strongText} testID="network-code">{myCode ?? (code.error ? '—' : '…')}</T>
          <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>
            Müşterileriniz tedarikçi eklerken bu kodu girer; isteği onaylayınca size SoleCost üzerinden sipariş verebilirler.
          </T>
          {myCode ? (
            <View style={styles.row}>
              <Button title="Kopyala" icon="link" variant="secondary" style={{ flex: 1 }} testID="network-code-copy"
                onPress={() => { void Clipboard.setStringAsync(myCode).then(() => notify('Firma kodu kopyalandı', myCode)); }} />
              <Button title="Paylaş" icon="share" variant="secondary" style={{ flex: 1 }} onPress={share} testID="network-code-share" />
            </View>
          ) : null}
        </Card>

        <Section title={`Gelen bağlantı istekleri (${pending.length})`}>
          {pending.length === 0 ? <Empty message="Bekleyen istek yok." /> : pending.map(l => (
            <Card key={l.id} testID={`link-request-${l.id}`}>
              <View style={styles.between}>
                <T style={{ fontWeight: '700', flex: 1 }}>{l.buyerCompany.name}</T>
                <Badge label={LINK_STATUS.PENDING.label} tone="warning" />
              </View>
              <T variant="small">
                {[l.buyerCompany.taxId && `VKN ${l.buyerCompany.taxId}`, l.buyerCompany.phone, formatDate(l.createdAt)].filter(Boolean).join(' · ')}
              </T>
              {manager ? (
                <>
                  <T variant="small">Onaylayınca bu firmanın siparişleri bir müşteri kaydına düşer:</T>
                  <View style={styles.row}>
                    <Button title="Yeni müşteri aç" style={{ flex: 1 }} loading={busy === l.id} onPress={() => { void approve(l); }} testID={`link-approve-new-${l.id}`} />
                    <Button title="Müşteriyle eşleştir" variant="secondary" style={{ flex: 1 }} disabled={busy === l.id}
                      onPress={() => setMatching(l)} testID={`link-approve-match-${l.id}`} />
                  </View>
                  <Button title="Reddet" variant="ghost" disabled={busy === l.id} onPress={() => { void reject(l); }} testID={`link-reject-${l.id}`} />
                </>
              ) : (
                <T variant="small" color={c.warning}>İsteği firma sahibi ya da yöneticisi onaylayabilir.</T>
              )}
            </Card>
          ))}
        </Section>

        <Section title={`Bağlı müşteriler (${activeCustomers.length})`}>
          {activeCustomers.length === 0 ? <Empty message="SoleCost üzerinden bağlı müşteri yok." /> : (
            <Card style={{ padding: 0, gap: 0 }}>
              {activeCustomers.map(l => (
                <ListRow
                  key={l.id}
                  title={l.buyerCompany.name}
                  subtitle={l.sellerCustomer ? `Müşteri kaydı: ${l.sellerCustomer.name}` : undefined}
                  right={LINK_STATUS.ACTIVE.label}
                  rightColor={c.success}
                  onPress={l.sellerCustomer ? () => router.push(`/cariler/customer/${l.sellerCustomer!.id}`) : undefined}
                />
              ))}
            </Card>
          )}
        </Section>

        <Section title={`Bağlı tedarikçiler (${suppliers.length})`}>
          {suppliers.length === 0 ? (
            <Empty message="Tedarikçiniz SoleCost kullanıyorsa, tedarikçi sayfasından firma koduyla bağlanabilirsiniz." />
          ) : (
            <Card style={{ padding: 0, gap: 0 }}>
              {suppliers.map(l => {
                const st = LINK_STATUS[l.status];
                return (
                  <ListRow
                    key={l.id}
                    title={l.sellerCompany.name}
                    subtitle={formatDate(l.respondedAt ?? l.createdAt)}
                    right={st.label}
                    rightColor={st.tone === 'success' ? c.success : st.tone === 'warning' ? c.warning : st.tone === 'danger' ? c.danger : c.textSecondary}
                    onPress={l.buyerSupplierId ? () => router.push(`/cariler/supplier/${l.buyerSupplierId}`) : undefined}
                  />
                );
              })}
            </Card>
          )}
        </Section>
      </Screen>

      <Picker
        visible={!!matching}
        title={matching ? `${matching.buyerCompany.name} → müşteri seç` : 'Müşteri seç'}
        items={(customers.data ?? []).map(x => ({ id: x.id, title: x.name, right: x.currency }))}
        loading={customers.isLoading}
        onPick={id => { const l = matching!; setMatching(null); void approve(l, id); }}
        onClose={() => setMatching(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
