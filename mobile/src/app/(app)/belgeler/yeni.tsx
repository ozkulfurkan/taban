import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LineEditor, type Catalog } from '@/components/line-editor';
import { Picker } from '@/components/picker';
import { Button, Card, Field, Screen, Section, T } from '@/components/ui';
import { api } from '@/core/api';
import { confirm, notify } from '@/core/dialog';
import {
  DOC_TITLE, invoiceBody, isPurchaseKind, purchaseBody, totalsOf, validateLines, type DocKind, type FormLine,
} from '@/core/documents';
import { isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

const VAT_RATES = [0, 1, 10, 20];
const KINDS: DocKind[] = ['sale', 'return', 'purchase', 'purchaseReturn'];

type Party = { id: string; name: string; currency?: string };

// Yeni satış, müşteri iadesi, alış ya da tedarikçiye iade. Kurallar web ile aynı API'den geçer.
export default function NewDocument() {
  const c = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ kind?: string; partyId?: string }>();
  const kind: DocKind = KINDS.includes(params.kind as DocKind) ? (params.kind as DocKind) : 'sale';
  const purchase = isPurchaseKind(kind);

  const [partyId, setPartyId] = useState<string | null>(params.partyId ?? null);
  const [pickingParty, setPickingParty] = useState(false);
  const [date, setDate] = useState(isoDay());
  const [dueDate, setDueDate] = useState('');
  const [vatRate, setVatRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<FormLine[]>([]);
  const [editing, setEditing] = useState<FormLine | 'new' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Cari listesi: müşterilerde hafif liste, seçilen müşterinin dövizi ayrıca okunur
  const customers = useApi<Party[]>(!purchase ? '/api/customers' : null, { minimal: 'true' });
  const suppliers = useApi<Party[]>(purchase ? '/api/suppliers' : null);
  const partyDetail = useApi<Party>(partyId ? `/api/${purchase ? 'suppliers' : 'customers'}/${partyId}` : null);
  const products = useApi<Catalog['products']>('/api/products');
  const materials = useApi<Catalog['materials']>(purchase ? '/api/materials' : null);
  const prices = useApi<{ productId: string; unitPrice: number; currency: string }[]>(
    !purchase && partyId ? `/api/customers/${partyId}/prices` : null,
  );

  const party = partyDetail.data ?? null;
  const currency = party?.currency || 'TRY';
  const catalog: Catalog = useMemo(() => ({
    products: products.data ?? [],
    materials: materials.data ?? [],
    specialPrices: Object.fromEntries((prices.data ?? []).map(p => [p.productId, { unitPrice: p.unitPrice, currency: p.currency }])),
    loading: products.isLoading || materials.isLoading,
  }), [products.data, materials.data, prices.data, products.isLoading, materials.isLoading]);

  const effectiveVat = purchase ? 0 : vatRate;
  const totals = useMemo(() => totalsOf(lines, effectiveVat), [lines, effectiveVat]);
  const partyList = (purchase ? suppliers.data : customers.data) ?? [];

  const choosePartyThenCheck = async (id: string) => {
    setPickingParty(false);
    // Cari değişince kalem fiyatları eski dövizde kalabilir
    if (lines.length && id !== partyId && !(await confirm('Cari değişsin mi?', 'Kalemlerdeki fiyatları yeni carinin dövizine göre kontrol edin.', 'Değiştir'))) return;
    setPartyId(id);
  };

  const saveLine = (l: FormLine) => {
    setLines(ls => (ls.some(x => x.key === l.key) ? ls.map(x => (x.key === l.key ? l : x)) : [...ls, l]));
    setEditing(null);
  };

  const save = async () => {
    setError('');
    if (!partyId || !party) return setError(purchase ? 'Tedarikçi seçin.' : 'Müşteri seçin.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Tarihi YYYY-AA-GG biçiminde girin.');
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return setError('Vade tarihini YYYY-AA-GG biçiminde girin.');
    const lineError = validateLines(kind, lines);
    if (lineError) return setError(lineError);
    setSaving(true);
    try {
      const doc = purchase
        ? await api<any>('/api/purchases', { method: 'POST', body: purchaseBody({ kind, supplierId: partyId, currency, date, notes, lines }) })
        : await api<any>('/api/invoices', { method: 'POST', body: invoiceBody({ kind, customerId: partyId, currency, date, dueDate, vatRate, notes, lines }) });
      await qc.invalidateQueries();
      const warnings: any[] = doc?.stockWarnings ?? [];
      router.replace(`/belgeler/${purchase ? 'alis' : 'satis'}/${doc.id}`);
      notify(
        `${doc.invoiceNo ?? 'Belge'} kaydedildi`,
        warnings.length ? `Stok eksiye düştü: ${warnings.map(w => w.name).slice(0, 3).join(', ')}` : `${money(doc.total, currency)} — ${party.name}`,
      );
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: DOC_TITLE[kind], headerLargeTitle: false, presentation: 'modal' }} />
      <Screen>
        <Card onPress={() => setPickingParty(true)} testID="doc-party">
          <T variant="label">{purchase ? 'Tedarikçi' : 'Müşteri'}</T>
          <T style={{ fontWeight: '600' }} color={party ? c.text : c.primary}>
            {party ? `${party.name} · ${currency}` : partyId ? 'Yükleniyor…' : 'Seçmek için dokunun'}
          </T>
        </Card>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Tarih" value={date} onChangeText={setDate} autoCapitalize="none" placeholder="YYYY-AA-GG" />
          </View>
          {kind === 'sale' ? (
            <View style={{ flex: 1 }}>
              <Field label="Vade" value={dueDate} onChangeText={setDueDate} autoCapitalize="none" placeholder="YYYY-AA-GG" />
            </View>
          ) : null}
        </View>

        <Section
          title={`Kalemler (${lines.length})`}
          action={
            <Pressable onPress={() => setEditing('new')} accessibilityRole="button" hitSlop={8} testID="doc-add-line" style={styles.add}>
              <Icon name="plus" size={16} color={c.primary} />
              <T color={c.primary} style={{ fontWeight: '600' }}>Kalem ekle</T>
            </Pressable>
          }
        >
          {lines.length === 0 ? (
            <Card onPress={() => setEditing('new')}>
              <T variant="small">Henüz kalem yok. Eklemek için dokunun.</T>
            </Card>
          ) : lines.map((l, i) => (
            <Card key={l.key} onPress={() => setEditing(l)} testID={`doc-line-${i}`}>
              <View style={styles.lineHead}>
                <T style={{ flex: 1, fontWeight: '600' }} numberOfLines={2}>{l.code ? `[${l.code}] ` : ''}{l.description}</T>
                <Pressable
                  onPress={() => setLines(ls => ls.filter(x => x.key !== l.key))}
                  accessibilityRole="button"
                  accessibilityLabel="Kalemi sil"
                  hitSlop={10}
                >
                  <T color={c.danger} variant="small">Sil</T>
                </Pressable>
              </View>
              <View style={styles.lineHead}>
                <T variant="small" style={{ flex: 1 }}>
                  {l.quantity || '0'}{l.type === 'material' ? ' kg' : ''} × {l.unitPrice || '0'}
                  {Number(l.discount.replace(',', '.')) > 0 ? ` · %${l.discount} isk.` : ''}
                </T>
                <T variant="money">{money(totals.lineTotals[i], currency)}</T>
              </View>
            </Card>
          ))}
        </Section>

        {!purchase ? (
          <View style={{ gap: 8 }}>
            <T variant="label">KDV</T>
            <View style={styles.chips}>
              {VAT_RATES.map(r => {
                const on = r === vatRate;
                return (
                  <Pressable key={r} onPress={() => setVatRate(r)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }]}>
                    <T color={on ? c.primary : c.text} style={{ fontWeight: '600' }}>%{r}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Card>
          {!purchase && effectiveVat > 0 ? (
            <>
              <Row label="Ara toplam" value={money(totals.subtotal, currency)} />
              <Row label={`KDV %${effectiveVat}`} value={money(totals.vatAmount, currency)} />
            </>
          ) : null}
          <Row label="Toplam" value={money(totals.total, currency)} strong testID="doc-total" />
        </Card>

        <Field label="Not" value={notes} onChangeText={setNotes} placeholder="İsteğe bağlı" multiline style={{ minHeight: 70, paddingTop: 12 }} />

        {error ? <T color={c.danger} testID="doc-error">{error}</T> : null}
        <Button title={`Kaydet · ${money(totals.total, currency)}`} onPress={save} loading={saving} testID="doc-save" />
      </Screen>

      <Picker
        visible={pickingParty}
        title={purchase ? 'Tedarikçi seç' : 'Müşteri seç'}
        items={partyList.map(p => ({ id: p.id, title: p.name, right: p.currency }))}
        loading={purchase ? suppliers.isLoading : customers.isLoading}
        onPick={id => { void choosePartyThenCheck(id); }}
        onClose={() => setPickingParty(false)}
      />
      {editing ? (
        <LineEditor
          kind={kind}
          currency={currency}
          initial={editing === 'new' ? null : editing}
          catalog={catalog}
          onSave={saveLine}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function Row({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={styles.totalRow}>
      <T variant={strong ? 'body' : 'small'} style={strong ? { fontWeight: '700' } : undefined}>{label}</T>
      <T variant="money" style={strong ? { fontSize: 18 } : undefined} testID={testID}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
