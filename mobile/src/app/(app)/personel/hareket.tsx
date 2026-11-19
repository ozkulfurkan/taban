import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, Field, Loading, Screen, T } from '@/components/ui';
import { formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { isoDay, money } from '@/core/format';
import { LEDGER_TYPES, isCashPayment, type Employee, type LedgerType } from '@/core/personnel';
import type { Account } from '@/core/accounts';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

// Personel hesap hareketi: maaş/avans (kasadan/bankadan ödeme), hakediş/prim, kesinti
export default function PersonelHareket() {
  const c = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const emp = useApi<Employee>(`/api/personnel/${id}`);
  const accounts = useApi<Account[]>('/api/accounts');
  const [type, setType] = useState<LedgerType>('Maaş');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(isoDay());
  const [desc, setDesc] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (emp.isLoading || accounts.isLoading) return <><Stack.Screen options={{ title: 'Personel hareketi' }} /><Loading /></>;
  if (emp.error || !emp.data) return <><Stack.Screen options={{ title: 'Personel hareketi' }} /><ErrorState message={(emp.error as Error)?.message || 'Personel bulunamadı'} /></>;
  const e = emp.data;
  // Ödeme, personelin para birimindeki kasa/banka hesabından çıkar
  const usable = (accounts.data ?? []).filter(a => a.currency === e.currency);
  const cash = isCashPayment(type);
  const amt = parseAmountInput(amount);

  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Tutar girin.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Tarihi YYYY-AA-GG biçiminde girin.');
    if (cash && !accountId) return setError(`Ödemenin çıkacağı ${e.currency} kasa/banka hesabını seçin.`);
    const acc = usable.find(a => a.id === accountId);
    setSaving(true);
    try {
      await api(`/api/personnel/${e.id}/ledger`, {
        method: 'POST',
        body: { type, amount: amt, date, description: desc.trim() || undefined, ...(cash && acc ? { accountId: acc.id, account: acc.name } : {}) },
      });
      await qc.invalidateQueries();
      router.back();
      notify(`${type} kaydedildi`, `${money(amt, e.currency)} — ${e.name}`);
    } catch (err: any) { setError(err?.message || 'Kaydedilemedi'); } finally { setSaving(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title: e.name }} />
      <Screen>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {LEDGER_TYPES.map(t => {
            const on = t === type;
            return (
              <Pressable key={t} onPress={() => setType(t)} accessibilityRole="tab" accessibilityState={{ selected: on }} testID={`ledger-type-${t}`}
                style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }]}>
                <T color={on ? c.primary : c.text} style={{ fontWeight: '600' }}>{t}</T>
              </Pressable>
            );
          })}
        </ScrollView>
        <T variant="small">
          {cash ? 'Ödeme seçilen hesaptan çıkar; personele borcunuz azalır.'
            : type === 'Kesinti' ? 'Personelin hakedişinden düşülür.' : 'Personelin hak ettiği tutar; personele borcunuz artar.'}
        </T>
        <Field label={`Tutar (${e.currency})`} value={amount} onChangeText={v => setAmount(formatAmountInput(v))} keyboardType="decimal-pad" placeholder="0,00" testID="ledger-amount" />
        <Field label="Tarih (YYYY-AA-GG)" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Field label="Açıklama" value={desc} onChangeText={setDesc} placeholder="İsteğe bağlı" />
        {cash ? (
          <View style={{ gap: 6 }}>
            <T variant="label">Ödeme hesabı ({e.currency})</T>
            {usable.length === 0 ? <T variant="small" color={c.warning}>{e.currency} para biriminde kasa/banka hesabı yok.</T> : (
              <Card style={{ padding: 0, gap: 0 }}>
                {usable.map((a, i) => (
                  <Pressable key={a.id} onPress={() => setAccountId(a.id)} accessibilityRole="radio" accessibilityState={{ selected: a.id === accountId }} testID={`ledger-acc-${a.id}`}
                    style={[styles.acc, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, a.id === accountId && { backgroundColor: c.primarySoft }]}>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '600' }}>{a.name}</T>
                      <T variant="small">{a.type}</T>
                    </View>
                    <T variant="small">{money(a.balance, a.currency)}</T>
                  </Pressable>
                ))}
              </Card>
            )}
          </View>
        ) : null}
        {error ? <T color={c.danger} testID="ledger-error">{error}</T> : null}
        <Button title={`Kaydet${amt > 0 ? ` · ${money(amt, e.currency)}` : ''}`} onPress={save} loading={saving} testID="ledger-save" />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  acc: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
