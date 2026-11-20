import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Empty, ErrorState, Loading, Screen, Segmented, T } from '@/components/ui';
import { useAuth, useCanWrite } from '@/core/auth';
import { formatDate, isoDay, money } from '@/core/format';
import { useLinkSheet } from '@/components/link-sheet';
import { notify } from '@/core/dialog';
import { shareStatementPdf, useStatement, type PartyKind } from '@/core/statement';
import { useTheme } from '@/hooks/use-theme';
import type { StatementRow } from '@shared/statement-rows';

type Range = '1' | '3' | '6' | '12' | 'year';
function rangeFrom(r: Range) {
  const d = new Date();
  if (r === 'year') return `${d.getFullYear()}-01-01`;
  d.setMonth(d.getMonth() - Number(r));
  return isoDay(d);
}

export default function Ekstre() {
  const c = useTheme();
  const { user } = useAuth();
  // link: firma ağı karşı ekstresi (bağlı firmanın sizin için tuttuğu kayıtlar)
  const { kind, id, link } = useLocalSearchParams<{ kind: PartyKind; id: string; link?: string }>();
  const k: PartyKind = kind === 'supplier' ? 'supplier' : 'customer';
  const [range, setRange] = useState<Range>('1');
  const from = rangeFrom(range);
  const to = isoDay();
  const st = useStatement(k, id, from, to, link || null);
  const title = link ? 'Karşı ekstre' : 'Ekstre';
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const canWrite = useCanWrite();
  const linkSheet = useLinkSheet(k, id, st.party?.name ?? '', canWrite);

  const items = useMemo(() => {
    const m: Record<string, StatementRow[]> = {};
    st.result?.rows.forEach(r => { if (r.isSubRow && r.parentId) (m[r.parentId] ||= []).push(r); });
    return m;
  }, [st.result]);

  if (st.isLoading) return <><Stack.Screen options={{ title }} /><Loading /></>;
  if (st.error || !st.result || !st.party) return <><Stack.Screen options={{ title }} /><ErrorState message={(st.error as Error)?.message || 'Ekstre yüklenemedi'} onRetry={() => st.refetch()} /></>;

  const cur = st.party.currency || 'TRY';
  const { rows, totalBorc, totalAlacak, lastBalance } = st.result;
  const main = rows.filter(r => !r.isSubRow);
  const companyName = st.owner?.name ?? (user?.type === 'staff' ? user.companyName : null);

  const pdf = async () => {
    setBusy(true);
    try { await shareStatementPdf({ partyName: st.party!.name, currency: cur, from, to, result: st.result!, companyName }); }
    catch (e: any) { notify('PDF oluşturulamadı', e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen refreshing={st.isRefetching} onRefresh={() => { void st.refetch(); }}>
        {st.owner ? (
          <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primarySoft }} testID="link-statement-info">
            <T style={{ fontWeight: '700' }}>{st.owner.name}</T>
            <T variant="small">Bu firmanın sizin için tuttuğu hesap ekstresi. Kendi kayıtlarınızla karşılaştırarak mutabakat yapabilirsiniz.</T>
          </Card>
        ) : <T variant="heading">{st.party.name}</T>}
        <Segmented
          value={range}
          onChange={setRange}
          options={[{ value: '1', label: '1 ay' }, { value: '3', label: '3 ay' },{ value: '6', label: '6 ay' }, { value: '12', label: '12 ay' }, { value: 'year', label: 'Bu yıl' }]}
        />
        <T variant="small">{formatDate(from)} – {formatDate(to)}</T>

        <View style={styles.totals}>
          <Total label="Borç" value={money(totalBorc, cur)} />
          <Total label="Alacak" value={money(totalAlacak, cur)} />
          <Total label="Bakiye" value={money(lastBalance, cur)} strong />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="PDF" icon="pdf" variant="secondary" onPress={pdf} loading={busy} style={{ flex: 1 }} />
          {link ? null : <Button title="Link Gönder" icon="link" variant="secondary" onPress={linkSheet.open} loading={linkSheet.busy} style={{ flex: 1 }} />}
        </View>

        {main.length === 0 ? <Empty message="Bu dönemde hareket yok." /> : main.map(r => {
          const sub = items[r.id];
          const isOpen = !!open[r.id];
          return (
            <Card key={r.id} testID={`row-${r.id}`}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={{ fontWeight: '600' }}>{r.hareket}{r.belgeNo ? ` · ${r.belgeNo}` : ''}</T>
                  <T variant="small">{formatDate(r.date)}{r.dueDate ? ` · Vade ${formatDate(r.dueDate)}` : ''}</T>
                </View>
                <T variant="money" color={r.borc > 0 ? c.text : c.success}>
                  {r.borc > 0 ? money(r.borc, cur) : `−${money(r.alacak, cur)}`}
                </T>
              </View>
              {r.aciklama ? <T variant="small">{r.aciklama}</T> : null}
              {r.extraInfo ? <T variant="small" color={c.textMuted}>{r.extraInfo}</T> : null}
              {sub ? (
                <Pressable onPress={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))} accessibilityRole="button" style={styles.toggle}>
                  <T variant="small" color={c.primary}>{isOpen ? 'Kalemleri gizle' : `${sub.length} kalem`}</T>
                </Pressable>
              ) : null}
              {sub && isOpen ? sub.map(it => (
                <View key={it.id} style={[styles.item, { borderTopColor: c.border }]}>
                  <T variant="small" style={{ flex: 1 }}>{it.productCode ? `[${it.productCode}] ` : ''}{it.aciklama}</T>
                  <T variant="small">{it.miktar}{it.fiyat != null ? ` × ${money(it.fiyat, '').trim()}` : ''}</T>
                  {it.tutar != null ? <T variant="small" style={{ fontWeight: '600' }}>{money(it.tutar, '').trim()}</T> : null}
                </View>
              )) : null}
              <View style={[styles.balance, { borderTopColor: c.border }]}>
                <T variant="small">Bakiye</T>
                <T variant="small" style={{ fontWeight: '600' }}>{money(r.bakiye, cur)}</T>
              </View>
            </Card>
          );
        })}
      </Screen>
      {linkSheet.sheet}
    </>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const c = useTheme();
  return (
    <Card style={[{ flex: 1, gap: 2, paddingVertical: 12 }, strong && { backgroundColor: c.strong, borderColor: c.strong }]}>
      <T variant="small" color={strong ? c.strongText : undefined}>{label}</T>
      <T variant="money" color={strong ? c.strongText : undefined} fit style={{ fontSize: 14 }}>{value}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 8 },
  rowHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  toggle: { alignSelf: 'flex-start', paddingVertical: 2 },
  item: { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  balance: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
});
