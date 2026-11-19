import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CekActionModal } from '@/components/cek-actions';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { Badge, Button, Card, Empty, ErrorState, Loading, T } from '@/components/ui';
import { api } from '@/core/api';
import { useCanWrite } from '@/core/auth';
import { availableActions, DURUM_LABEL, type BulkAction, type Cek } from '@/core/cek';
import { formatDate, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { daysToVade, totalsByCurrency, vadeTone, weightedAvgVade } from '@shared/cek';

type Page = { cekler: Cek[]; page: number; pages: number; totals: { currency: string; count: number; total: number; avgVadeMs: number | null }[] };

const TABS: { key: string; label: string }[] = [
  { key: 'PORTFOY', label: 'Portföy' },
  { key: 'BANKAYA_VERILDI', label: 'Bankada' },
  { key: 'TEDARIKCI_VERILDI', label: 'Tedarikçide' },
  { key: 'ODENDI', label: 'Ödendi' },
  { key: '', label: 'Tümü' },
];

export default function Cekler() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const [durum, setDurum] = useState('PORTFOY');
  const [vade, setVade] = useState<'' | 'overdue' | 'week'>('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Record<string, Cek>>({});
  const [action, setAction] = useState<{ kind: BulkAction; cekler: Cek[] } | null>(null);
  const [detail, setDetail] = useState<Cek | null>(null);
  const rates = useApi<{ usd: number; eur: number }>('/api/exchange-rates');

  const q = useInfiniteQuery({
    queryKey: ['cekler', durum, vade],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api<Page>('/api/cek', { query: { page: pageParam, durum, vade }, signal }),
    getNextPageParam: last => (last.page < last.pages ? last.page + 1 : undefined),
  });
  const rows = useMemo(() => q.data?.pages.flatMap(p => p.cekler) ?? [], [q.data]);
  const totals = q.data?.pages[0]?.totals ?? [];

  const sel = Object.values(selected);
  const acts = availableActions(sel);
  const avg = sel.length ? weightedAvgVade(sel, rates.data ?? {}) : null;

  const toggle = (ch: Cek) => setSelected(s => {
    const n = { ...s };
    if (n[ch.id]) delete n[ch.id]; else n[ch.id] = ch;
    return n;
  });
  const clearSel = () => { setSelected({}); setSelecting(false); };
  const changeTab = (k: string) => { setDurum(k); clearSel(); };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Çekler',
          headerRight: canWrite ? () => (
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
              <Pressable onPress={() => (selecting ? clearSel() : setSelecting(true))} hitSlop={10} accessibilityRole="button" testID="cek-select">
                <T color={c.primary} style={{ fontWeight: '600' }}>{selecting ? 'Bitti' : 'Seç'}</T>
              </Pressable>
              <Pressable onPress={() => router.push('/cekler/yeni')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Yeni çek" testID="cek-new">
                <Icon name="plus" size={24} color={c.primary} />
              </Pressable>
            </View>
          ) : undefined,
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        contentContainerStyle={{ paddingBottom: sel.length ? 160 : 24 }}
        data={q.isLoading || q.error ? [] : rows}
        keyExtractor={r => r.id}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingVertical: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {TABS.map(t => <Chip key={t.key} label={t.label} on={durum === t.key} onPress={() => changeTab(t.key)} />)}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
              <Chip label="Vadesi geçmiş" on={vade === 'overdue'} tone="danger" onPress={() => setVade(v => (v === 'overdue' ? '' : 'overdue'))} />
              <Chip label="Bu hafta" on={vade === 'week'} tone="warning" onPress={() => setVade(v => (v === 'week' ? '' : 'week'))} />
            </View>
            {totals.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {totals.map(t => (
                  <Card key={t.currency} style={{ minWidth: 150, gap: 2, paddingVertical: 10 }} testID={`cek-total-${t.currency}`}>
                    <T variant="small">{t.count} çek · {t.currency}</T>
                    <T variant="money">{money(t.total, t.currency)}</T>
                    {t.avgVadeMs ? <T variant="small">Ort. vade {formatDate(t.avgVadeMs)}</T> : null}
                  </Card>
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? <Loading /> : q.error
            ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
            : <Empty message="Bu filtrede çek yok." />
        }
        renderItem={({ item }) => (
          <CekRow
            cek={item}
            selecting={selecting}
            checked={!!selected[item.id]}
            onPress={() => (selecting ? toggle(item) : setDetail(item))}
            onLongPress={canWrite ? () => { setSelecting(true); toggle(item); } : undefined}
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
      />

      {sel.length ? (
        <View style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border }]} testID="cek-selection">
          <View style={styles.between}>
            <T style={{ fontWeight: '700' }}>{sel.length} çek seçildi</T>
            <Pressable onPress={clearSel} hitSlop={8} accessibilityRole="button"><T color={c.primary}>Temizle</T></Pressable>
          </View>
          <T variant="small" testID="cek-selection-summary">
            {totalsByCurrency(sel).map(t => money(t.total, t.currency)).join(' + ')}
            {avg ? ` · Ort. vade ${formatDate(avg.date)} (${avg.days >= 0 ? `${avg.days} gün` : `${-avg.days} gün geçti`})` : ''}
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {acts.bank ? <Button title="Bankaya" variant="secondary" onPress={() => setAction({ kind: 'bank', cekler: sel })} style={{ flex: 1 }} testID="cek-act-bank" /> : null}
            {acts.supplier ? <Button title="Tedarikçiye" variant="secondary" onPress={() => setAction({ kind: 'supplier', cekler: sel })} style={{ flex: 1 }} testID="cek-act-supplier" /> : null}
            {acts.collect ? <Button title="Tahsil et" onPress={() => setAction({ kind: 'collect', cekler: sel })} style={{ flex: 1 }} testID="cek-act-collect" /> : null}
          </View>
          {!acts.bank && !acts.collect ? <T variant="small" color={c.warning}>Seçili çeklerin durumu toplu işlem için uygun değil.</T> : null}
        </View>
      ) : null}

      {action ? (
        <CekActionModal action={action.kind} cekler={action.cekler} onClose={() => setAction(null)} onDone={() => { setAction(null); clearSel(); }} />
      ) : null}

      <Sheet
        visible={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.borclu} · ${money(detail.tutar, detail.currency)}` : ''}
        actions={detail && canWrite ? [
          ...(availableActions([detail]).bank ? [{ label: 'Bankaya ver', icon: 'wallet' as const, onPress: () => setAction({ kind: 'bank', cekler: [detail] }) }] : []),
          ...(availableActions([detail]).supplier ? [{ label: 'Tedarikçiye ver', icon: 'arrowUp' as const, onPress: () => setAction({ kind: 'supplier', cekler: [detail] }) }] : []),
          ...(availableActions([detail]).collect ? [{ label: 'Tahsil et', icon: 'arrowDown' as const, onPress: () => setAction({ kind: 'collect', cekler: [detail] }) }] : []),
          ...(detail.customer ? [{ label: `Müşteri: ${detail.customer.name}`, icon: 'people' as const, onPress: () => router.push(`/cariler/customer/${detail.customer!.id}`) }] : []),
          ...(detail.supplier ? [{ label: `Tedarikçi: ${detail.supplier.name}`, icon: 'people' as const, onPress: () => router.push(`/cariler/supplier/${detail.supplier!.id}`) }] : []),
        ] : []}
      >
        {detail ? (
          <View style={{ gap: 4 }}>
            <T variant="small">Durum: {DURUM_LABEL[detail.durum] ?? detail.durum}{detail.bankAccount ? ` · ${detail.bankAccount.name}` : ''}</T>
            <T variant="small">Vade: {formatDate(detail.vadesi)}{detail.islemTarihi ? ` · İşlem: ${formatDate(detail.islemTarihi)}` : ''}</T>
            {detail.bankasi || detail.seriNo ? <T variant="small">{[detail.bankasi, detail.seriNo ? `Seri ${detail.seriNo}` : ''].filter(Boolean).join(' · ')}</T> : null}
            {detail.customerAmount ? <T variant="small">Müşteriye yansıyan: {money(detail.customerAmount, '').trim()}</T> : null}
            {detail.aciklama ? <T variant="small">{detail.aciklama}</T> : null}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function CekRow({ cek, selecting, checked, onPress, onLongPress }: {
  cek: Cek; selecting: boolean; checked: boolean; onPress: () => void; onLongPress?: () => void;
}) {
  const c = useTheme();
  const tone = vadeTone(cek);
  const d = daysToVade(cek.vadesi);
  const vadeColor = tone === 'overdue' ? c.danger : tone === 'soon' ? c.warning : c.textSecondary;
  const active = tone !== 'normal' || cek.durum === 'PORTFOY' || cek.durum === 'BANKAYA_VERILDI';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked } : undefined}
      testID={`cek-${cek.id}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: checked ? c.primarySoft : tone === 'overdue' ? c.dangerSoft : c.card, borderBottomColor: c.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      {selecting ? (
        <View style={[styles.check, { borderColor: checked ? c.primary : c.textMuted, backgroundColor: checked ? c.primary : 'transparent' }]}>
          {checked ? <T color="#fff" style={{ fontSize: 12, fontWeight: '700' }}>✓</T> : null}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T style={{ fontWeight: '600' }} numberOfLines={1}>{cek.customer?.name || cek.borclu}</T>
        <T variant="small" numberOfLines={1}>{[cek.bankasi, cek.seriNo].filter(Boolean).join(' · ') || cek.borclu}</T>
        <T variant="small" color={vadeColor} testID={`cek-vade-${cek.id}`}>
          Vade {formatDate(cek.vadesi)}
          {active ? ` · ${d < 0 ? `${-d} gün geçti` : d === 0 ? 'bugün' : `${d} gün kaldı`}` : ''}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <T variant="money" color={tone === 'overdue' ? c.danger : undefined}>{money(cek.tutar, cek.currency)}</T>
        <Badge label={DURUM_LABEL[cek.durum] ?? cek.durum} tone={cek.durum === 'ODENDI' ? 'success' : cek.durum === 'BANKAYA_VERILDI' ? 'primary' : 'neutral'} />
      </View>
    </Pressable>
  );
}

function Chip({ label, on, onPress, tone }: { label: string; on: boolean; onPress: () => void; tone?: 'danger' | 'warning' }) {
  const c = useTheme();
  const accent = tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : c.primary;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? accent : c.border, backgroundColor: on ? c.card : c.card }]}>
      <T color={on ? accent : c.textSecondary} style={{ fontWeight: on ? '700' : '500' }}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
