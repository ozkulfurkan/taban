import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StockAdjustModal } from '@/components/stock-adjust';
import { Button, Card, ErrorState, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { useCanWrite } from '@/core/auth';
import { formatDate } from '@/core/format';
import { useApi } from '@/core/query';
import { KIND_PATH, MOVE_LABEL, formatQty, type AdjustMode, type StockKind } from '@/core/stock';
import { useTheme } from '@/hooks/use-theme';

type Entry = {
  id: string; date: string; type: string; party: string; invoiceNo: string | null;
  qty?: number; kgAmount?: number; notes?: string | null; product?: string | null;
};
type Ekstre = {
  product?: { id: string; name: string; stock: number; unit: string };
  material?: { id: string; name: string; stock: number; category?: string | null };
  entries: Entry[];
};

const MAX_ROWS = 50;

// Stok detayı: mevcut miktar, elle düzeltme ve hareket geçmişi (web'deki stok ekstresi)
export default function StockDetail() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const { kind: k, id } = useLocalSearchParams<{ kind: StockKind; id: string }>();
  const kind: StockKind = k === 'material' ? 'material' : 'product';
  const q = useApi<Ekstre>(`/api/${KIND_PATH[kind]}/${id}/ekstre`);
  const [adjust, setAdjust] = useState<AdjustMode | null>(null);

  if (q.isLoading) return <><Stack.Screen options={{ title: kind === 'product' ? 'Ürün' : 'Hammadde' }} /><Loading /></>;
  const head = q.data?.product ?? q.data?.material;
  if (q.error || !head) return <><Stack.Screen options={{ title: kind === 'product' ? 'Ürün' : 'Hammadde' }} /><ErrorState message={(q.error as Error)?.message || 'Kayıt bulunamadı'} onRetry={() => { void q.refetch(); }} /></>;
  const unit = kind === 'product' ? (q.data!.product!.unit || 'çift') : 'kg';
  const item = { id: head.id, name: head.name, stock: head.stock, unit };
  const entries = q.data!.entries.slice(0, MAX_ROWS);

  return (
    <>
      <Stack.Screen options={{ title: head.name }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong }}>
          <T variant="small" color={c.strongText} style={{ opacity: 0.8 }}>{kind === 'product' ? 'Ürün stoku' : 'Hammadde stoku (ana depo)'}</T>
          <T variant="moneyLarge" color={head.stock < 0 ? c.strongNegative : c.strongText} fit testID="stock-current">{formatQty(head.stock)} {unit}</T>
          {head.stock < 0 ? <T variant="small" color={c.strongNegative}>Stok eksiye düşmüş</T> : null}
        </Card>

        {canWrite ? (
          <View style={styles.actions}>
            <Button title="Giriş" icon="arrowDown" onPress={() => setAdjust('in')} style={styles.action} testID="stock-in" />
            <Button title="Çıkış" icon="arrowUp" variant="secondary" onPress={() => setAdjust('out')} style={styles.action} testID="stock-out" />
            {kind === 'material' ? (
              <Button title="Sayım" icon="edit" variant="secondary" onPress={() => setAdjust('count')} style={styles.action} testID="stock-count" />
            ) : null}
          </View>
        ) : null}

        <Section title="Hareketler">
          <Card style={{ padding: 0, gap: 0 }}>
            {entries.length === 0 ? <View style={{ padding: 16 }}><T variant="small">Henüz hareket yok.</T></View> : entries.map(e => {
              const amount = (kind === 'product' ? e.qty : e.kgAmount) ?? 0;
              const label = e.type === 'stok_ayar' ? e.party : (MOVE_LABEL[e.type] ?? e.type);
              const who = e.type === 'stok_ayar' || e.party === 'Manuel Düzeltme' ? (e.notes || e.product || null) : e.party;
              return (
                <ListRow
                  key={e.id}
                  testID={`move-${e.id}`}
                  title={`${label}${e.invoiceNo ? ` · ${e.invoiceNo}` : ''}`}
                  subtitle={[formatDate(e.date), who].filter(Boolean).join(' · ')}
                  right={`${amount > 0 ? '+' : ''}${formatQty(amount)} ${unit}`}
                  rightColor={amount < 0 ? c.danger : c.success}
                />
              );
            })}
          </Card>
          {q.data!.entries.length > MAX_ROWS ? (
            <T variant="small" style={{ textAlign: 'center' }}>Son {MAX_ROWS} hareket gösteriliyor. Tamamı web uygulamasında.</T>
          ) : null}
        </Section>
      </Screen>
      {adjust ? <StockAdjustModal key={adjust} kind={kind} item={item} initialMode={adjust} onClose={() => setAdjust(null)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: '28%' },
});
