import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Picker } from '@/components/picker';
import { Button, Card, Field, Screen, T } from '@/components/ui';
import { amountToInput, formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { convertAmount } from '@shared/fx';
import { CURRENCIES, round2 } from '@shared/money';

type Party = { id: string; name: string; currency?: string };

// Müşteriden alınan çek: müşterinin bakiyesinden düşer (çek dövizi farklıysa müşteri dövizindeki karşılığıyla)
export default function NewCek() {
  const c = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const [customerId, setCustomerId] = useState<string | null>(params.customerId ?? null);
  const [picking, setPicking] = useState(false);
  const [borclu, setBorclu] = useState('');
  const [bankasi, setBankasi] = useState('');
  const [seriNo, setSeriNo] = useState('');
  const [tutar, setTutar] = useState('');
  const [currency, setCurrency] = useState<string | null>(null);
  const [vadesi, setVadesi] = useState('');
  const [customerAmountEdit, setCustomerAmountEdit] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const customers = useApi<Party[]>('/api/customers', { minimal: 'true' });
  const customer = useApi<Party>(customerId ? `/api/customers/${customerId}` : null);
  const rates = useApi<{ usd: number; eur: number }>('/api/exchange-rates');

  const custCur = customer.data?.currency || 'TRY';
  const cur = currency ?? custCur;
  const cross = !!customer.data && cur !== custCur;
  const amount = parseAmountInput(tutar);
  // Müşteriye yansıyacak tutar: TCMB kuruyla önerilir, düzenlenebilir
  const suggested = cross && amount > 0 && rates.data ? convertAmount(amount, cur, custCur, rates.data) : null;
  const customerAmountText = customerAmountEdit ?? (suggested != null ? amountToInput(suggested) : '');
  const customerAmount = parseAmountInput(customerAmountText);

  const save = async () => {
    setError('');
    if (!customerId || !customer.data) return setError('Müşteri seçin.');
    if (!(amount > 0)) return setError('Çek tutarını girin.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vadesi)) return setError('Vadeyi YYYY-AA-GG biçiminde girin.');
    if (cross && !(customerAmount > 0)) return setError(`Müşteriye yansıyacak ${custCur} tutarını girin.`);
    setSaving(true);
    try {
      await api('/api/cek', {
        method: 'POST',
        body: {
          customerId,
          borclu: borclu.trim() || customer.data.name,
          bankasi: bankasi.trim() || null,
          seriNo: seriNo.trim() || null,
          tutar: round2(amount),
          currency: cur,
          vadesi,
          islemTarihi: isoDay(),
          customerAmount: cross ? round2(customerAmount) : null,
          customerCurrency: cross ? custCur : null,
          aciklama: aciklama.trim() || null,
        },
      });
      await qc.invalidateQueries();
      router.back();
      notify('Çek kaydedildi', `${money(amount, cur)} — ${customer.data.name}`);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Müşteriden Çek', headerLargeTitle: false }} />
      <Screen>
        <Card onPress={() => setPicking(true)} testID="cek-customer">
          <T variant="label">Müşteri</T>
          <T style={{ fontWeight: '600' }} color={customer.data ? c.text : c.primary}>
            {customer.data ? `${customer.data.name} · ${custCur}` : customerId ? 'Yükleniyor…' : 'Seçmek için dokunun'}
          </T>
        </Card>
        <Field label="Borçlu (çeki yazan)" value={borclu} onChangeText={setBorclu} placeholder={customer.data?.name ?? ''} testID="cek-borclu" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Banka" value={bankasi} onChangeText={setBankasi} /></View>
          <View style={{ flex: 1 }}><Field label="Seri no" value={seriNo} onChangeText={setSeriNo} autoCapitalize="characters" testID="cek-seri" /></View>
        </View>

        <View style={{ gap: 8 }}>
          <T variant="label">Çekin dövizi</T>
          <View style={styles.row}>
            {CURRENCIES.map(k => {
              const on = k === cur;
              return (
                <Pressable key={k} onPress={() => { setCurrency(k); setCustomerAmountEdit(null); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }]}>
                  <T color={on ? c.primary : c.text} style={{ fontWeight: '600' }}>{k}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label={`Tutar (${cur})`} value={tutar} onChangeText={v => { setTutar(formatAmountInput(v)); setCustomerAmountEdit(null); }}
              keyboardType="decimal-pad" placeholder="0,00" testID="cek-tutar" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Vade (YYYY-AA-GG)" value={vadesi} onChangeText={setVadesi} autoCapitalize="none" testID="cek-vade" />
          </View>
        </View>
        {cross ? (
          <Card>
            <Field label={`Müşteriye yansıyacak (${custCur})`} value={customerAmountText}
              onChangeText={v => setCustomerAmountEdit(formatAmountInput(v))} keyboardType="decimal-pad" testID="cek-customer-amount" />
            <T variant="small">{rates.data ? 'TCMB kuruyla önerildi; değiştirebilirsiniz.' : 'Kur alınamadı; tutarı elle girin.'}</T>
          </Card>
        ) : null}
        <Field label="Açıklama" value={aciklama} onChangeText={setAciklama} placeholder="İsteğe bağlı" />
        {error ? <T color={c.danger} testID="cek-error">{error}</T> : null}
        <Button title="Çeki kaydet" onPress={save} loading={saving} testID="cek-save" />
      </Screen>
      <Picker
        visible={picking}
        title="Müşteri seç"
        items={(customers.data ?? []).map(p => ({ id: p.id, title: p.name }))}
        loading={customers.isLoading}
        onPick={id => { setCustomerId(id); setCurrency(null); setCustomerAmountEdit(null); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
});
