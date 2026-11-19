import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { amountToInput, formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { bulkBody, singleCurrency, suggestedSupplierAmounts, type BulkAction, type Cek } from '@/core/cek';
import { notify } from '@/core/dialog';
import { formatDate, isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { round2 } from '@shared/money';
import { Picker } from './picker';
import { DateField } from './date-field';
import { Button, Card, Field, T } from './ui';

type Account = { id: string; name: string; type: string; currency: string };
type Supplier = { id: string; name: string; currency: string };

const TITLE: Record<BulkAction, string> = { bank: 'Bankaya ver', collect: 'Tahsil et', supplier: 'Tedarikçiye ver' };
const DONE: Record<BulkAction, string> = { bank: 'bankaya verildi', collect: 'tahsil edildi', supplier: 'tedarikçiye verildi' };

/** Seçili çeklerle toplu işlem: tek istekte, biri uygun değilse hiçbiri değişmez (sunucu kuralı) */
export function CekActionModal({ action, cekler, onDone, onClose }: {
  action: BulkAction; cekler: Cek[]; onDone: () => void; onClose: () => void;
}) {
  const c = useTheme();
  const qc = useQueryClient();
  const accounts = useApi<Account[]>(action !== 'supplier' ? '/api/accounts' : null);
  const suppliers = useApi<Supplier[]>(action === 'supplier' ? '/api/suppliers' : null);
  const rates = useApi<{ usd: number; eur: number }>(action === 'supplier' ? '/api/exchange-rates' : null);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(isoDay());
  const [note, setNote] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cur = singleCurrency(cekler);
  // Tahsilde hesap çekle aynı dövizde olmalı; bankaya verirken banka hesapları önce gelir
  const accountList = useMemo(() => {
    const list = accounts.data ?? [];
    if (action === 'collect') return list.filter(a => a.currency === cur);
    return [...list].sort((a, b) => Number(b.type === 'Banka') - Number(a.type === 'Banka'));
  }, [accounts.data, action, cur]);

  const supplier = suppliers.data?.find(s => s.id === supplierId) ?? null;
  const suggested = useMemo(
    () => (supplier ? suggestedSupplierAmounts(cekler, supplier.currency, rates.data ?? {}) : {}),
    [supplier, cekler, rates.data],
  );
  const amountText = (id: string) => {
    if (edits[id] !== undefined) return edits[id];
    const v = suggested[id];
    return v == null ? '' : amountToInput(v);
  };
  const amounts: Record<string, number> = Object.fromEntries(cekler.map(ch => [ch.id, parseAmountInput(amountText(ch.id))]));
  const supplierTotal = round2(Object.values(amounts).reduce((s, v) => s + v, 0));

  const submit = async () => {
    setError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Tarih seçin.');
    if (action !== 'supplier' && !accountId) return setError('Hesap seçin.');
    if (action === 'supplier') {
      if (!supplier) return setError('Tedarikçi seçin.');
      const missing = cekler.find(ch => ch.currency !== supplier.currency && !(amounts[ch.id] > 0));
      if (missing) return setError(`${missing.seriNo || missing.borclu} çeki için ${supplier.currency} karşılığını girin.`);
    }
    setSaving(true);
    try {
      await api('/api/cek/bulk', {
        method: 'POST',
        body: bulkBody(action, cekler.map(ch => ch.id), { accountId, supplierId, date, note, amounts }),
      });
      await qc.invalidateQueries();
      onDone();
      notify(`${cekler.length} çek ${DONE[action]}`);
    } catch (e: any) {
      setError(e?.message || 'İşlem yapılamadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button"><T color={c.primary}>Vazgeç</T></Pressable>
          <T variant="heading">{TITLE[action]}</T>
          <View style={{ width: 52 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={styles.body}>
          <T variant="small">{cekler.length} çek seçildi</T>

          {action !== 'supplier' ? (
            <View style={{ gap: 8 }}>
              <T variant="label">{action === 'bank' ? 'Tahsile verilen banka hesabı' : `Paranın gireceği hesap${cur ? ` (${cur})` : ''}`}</T>
              {action === 'collect' && !cur ? (
                <T color={c.danger}>Seçili çekler farklı dövizlerde. Tahsil için aynı dövizdeki çekleri seçin.</T>
              ) : accountList.length === 0 && !accounts.isLoading ? (
                <T variant="small">Uygun hesap yok. Web uygulamasından ekleyebilirsiniz.</T>
              ) : (
                <View style={styles.chips}>
                  {accountList.map(a => {
                    const on = a.id === accountId;
                    return (
                      <Pressable key={a.id} onPress={() => setAccountId(a.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                        testID={`acc-${a.id}`}
                        style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }]}>
                        <T style={{ fontWeight: '600' }} color={on ? c.primary : c.text}>{a.name}</T>
                        <T variant="small">{a.type} · {a.currency}</T>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            <Card onPress={() => setPicking(true)} testID="cek-supplier">
              <T variant="label">Tedarikçi</T>
              <T style={{ fontWeight: '600' }} color={supplier ? c.text : c.primary}>
                {supplier ? `${supplier.name} · ${supplier.currency}` : 'Seçmek için dokunun'}
              </T>
            </Card>
          )}

          {cekler.map(ch => (
            <Card key={ch.id} style={{ gap: 4 }}>
              <View style={styles.between}>
                <T style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{ch.borclu}{ch.seriNo ? ` · ${ch.seriNo}` : ''}</T>
                <T variant="money">{money(ch.tutar, ch.currency)}</T>
              </View>
              <T variant="small">Vade {formatDate(ch.vadesi)}{ch.bankasi ? ` · ${ch.bankasi}` : ''}</T>
              {action === 'supplier' && supplier && ch.currency !== supplier.currency ? (
                <Field
                  label={`Tedarikçiye yansıyacak (${supplier.currency})`}
                  value={amountText(ch.id)}
                  onChangeText={v => setEdits(e => ({ ...e, [ch.id]: formatAmountInput(v) }))}
                  keyboardType="decimal-pad"
                  placeholder={rates.data ? '' : 'Kur alınamadı, elle girin'}
                  testID={`cek-amount-${ch.id}`}
                />
              ) : null}
            </Card>
          ))}

          {action === 'supplier' && supplier ? (
            <Card style={styles.between}>
              <T style={{ fontWeight: '700' }}>Tedarikçiye toplam</T>
              <T variant="money" testID="cek-supplier-total">{money(supplierTotal, supplier.currency)}</T>
            </Card>
          ) : null}

          <DateField label="Tarih" value={date} onChange={setDate} />
          <Field label="Not" value={note} onChangeText={setNote} placeholder="İsteğe bağlı" />
          {error ? <T color={c.danger} testID="cek-action-error">{error}</T> : null}
          <Button title={TITLE[action]} onPress={submit} loading={saving} disabled={action === 'collect' && !cur} testID="cek-action-save" />
        </ScrollView>
        <Picker
          visible={picking}
          title="Tedarikçi seç"
          items={(suppliers.data ?? []).map(s => ({ id: s.id, title: s.name, right: s.currency }))}
          loading={suppliers.isLoading}
          onPick={id => { setSupplierId(id); setEdits({}); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 120 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
