import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, Field, Loading, Screen, T } from '@/components/ui';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { amountToInput, formatAmountInput, parseAmountInput } from '@/core/amount';
import { fmt, isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import type { PartyKind } from '@/core/statement';
import { useTheme } from '@/hooks/use-theme';
import { crossRate } from '@shared/fx';
import { round2 } from '@shared/money';

type Account = { id: string; name: string; type: string; currency: string; balance: number };
type Party = { id: string; name: string; currency: string; balance: number };

// Tahsilat (müşteri) / ödeme (tedarikçi). Hesap dövizi carinin dövizinden farklıysa
// kur girilir ve cariye carinin dövizinde kaydedilir (web ile aynı kural ve not biçimi).
export default function Hareket() {
  const c = useTheme();
  const qc = useQueryClient();
  const { kind, id } = useLocalSearchParams<{ kind: PartyKind; id: string }>();
  const k: PartyKind = kind === 'supplier' ? 'supplier' : 'customer';
  const party = useApi<Party>(`/api/${k === 'customer' ? 'customers' : 'suppliers'}/${id}`);
  const accounts = useApi<Account[]>('/api/accounts');
  const rates = useApi<{ usd: number; eur: number }>('/api/exchange-rates');

  const [pickedAccountId, setAccountId] = useState<string | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  // Elle girilen kur, hangi hesap için girildiğiyle birlikte tutulur (hesap değişince öneriye döner)
  const [rateEdit, setRateEdit] = useState<{ accountId: string; value: string } | null>(null);
  const [date, setDate] = useState(isoDay());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cur = party.data?.currency || 'TRY';
  // Varsayılan hesap: carinin dövizindeki ilk hesap
  const accountId = pickedAccountId ?? (accounts.data?.find(a => a.currency === cur) ?? accounts.data?.[0])?.id ?? null;
  const account = accounts.data?.find(a => a.id === accountId) ?? null;
  const cross = !!account && account.currency !== cur;
  // Farklı dövizde TCMB kuruyla öneri (1 cari dövizi = X hesap dövizi), düzenlenebilir
  const suggested = cross && rates.data ? crossRate(cur, account!.currency, rates.data) : null;
  const rate = !cross ? '' : rateEdit && rateEdit.accountId === account!.id
    ? rateEdit.value
    : suggested ? amountToInput(suggested, 4) : '';
  const setRate = (v: string) => { if (account) setRateEdit({ accountId: account.id, value: v }); };

  const amt = parseAmountInput(amount);
  const r = parseAmountInput(rate);
  const recorded = useMemo(() => (cross ? (r > 0 ? round2(amt / r) : 0) : round2(amt)), [cross, amt, r]);

  if (party.isLoading || accounts.isLoading) return <><Stack.Screen options={{ title: k === 'customer' ? 'Tahsilat' : 'Ödeme' }} /><Loading /></>;
  if (party.error || accounts.error) return <><Stack.Screen options={{ title: k === 'customer' ? 'Tahsilat' : 'Ödeme' }} /><ErrorState message={((party.error || accounts.error) as Error).message} /></>;

  const title = k === 'customer' ? 'Tahsilat' : 'Ödeme';

  const save = async () => {
    setError('');
    if (!account) return setError('Kasa / banka hesabı seçin.');
    if (!(amt > 0)) return setError('Tutar girin.');
    if (cross && !(r > 0)) return setError('Kur girin.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Tarihi YYYY-AA-GG biçiminde girin.');
    setSaving(true);
    try {
      const rateNote = cross ? `${fmt(amt)} ${account.currency} | Kur: 1 ${cur} = ${rate} ${account.currency}` : '';
      await api('/api/payments', {
        method: 'POST',
        body: {
          [k === 'customer' ? 'customerId' : 'supplierId']: id,
          accountId: account.id,
          amount: recorded,
          currency: cur,
          originalAmount: cross ? round2(amt) : null,
          originalCurrency: cross ? account.currency : null,
          exchangeRate: cross ? Math.round(r * 10000) / 10000 : null,
          date,
          notes: [notes.trim(), rateNote].filter(Boolean).join(' | ') || null,
        },
      });
      await qc.invalidateQueries();
      router.back();
      notify(`${title} kaydedildi`, `${money(recorded, cur)} — ${party.data!.name}`);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Native modal olarak sunulmaz: ayar veri yüklendikten sonra geldiği için ekran açıkken
          sayfadan modala dönüyor ve dokunuşlarda yeniden çiziliyordu */}
      <Stack.Screen options={{ title }} />
      <Screen>
        <T variant="heading">{party.data!.name}</T>
        <T variant="small">Güncel bakiye: {money(party.data!.balance, cur)}</T>

        <View style={{ gap: 8 }}>
          <T variant="label">{k === 'customer' ? 'Paranın girdiği hesap' : 'Paranın çıktığı hesap'}</T>
          {(accounts.data ?? []).length === 0 ? (
            <T variant="small">Kasa / banka hesabı yok. Web uygulamasından ekleyebilirsiniz.</T>
          ) : (
            // Açılır liste: seçili hesap gösterilir, dokununca kasa ve banka hesapları açılır
            <View style={[styles.dropdown, { borderColor: accountsOpen ? c.primary : c.border, backgroundColor: c.card }]}>
              <Pressable
                onPress={() => setAccountsOpen(o => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: accountsOpen }}
                style={styles.dropdownHead}
                testID="payment-account"
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={1}>{account ? account.name : 'Hesap seçin'}</T>
                  {account ? <T variant="small">{account.type} · {account.currency}</T> : null}
                </View>
                <T color={c.primary} style={{ fontSize: 16 }}>{accountsOpen ? '▲' : '▼'}</T>
              </Pressable>
              {accountsOpen ? [...accounts.data!].sort((a, b) => Number(b.currency === cur) - Number(a.currency === cur)).map(a => {
                const on = a.id === accountId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => { setAccountId(a.id); setAccountsOpen(false); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.option, { borderTopColor: c.border, backgroundColor: on ? c.primarySoft : 'transparent' }, pressed && { opacity: 0.6 }]}
                    testID={`payment-account-${a.id}`}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={{ fontWeight: on ? '700' : '500' }} color={on ? c.primary : c.text} numberOfLines={1}>{a.name}</T>
                      <T variant="small">{a.type} · {a.currency}</T>
                    </View>
                    <T variant="small">{money(a.balance, a.currency)}</T>
                  </Pressable>
                );
              }) : null}
            </View>
          )}
        </View>

        <Field label={`Tutar${account ? ` (${account.currency})` : ''}`} value={amount} onChangeText={v => setAmount(formatAmountInput(v))}
          keyboardType="decimal-pad" placeholder="0,00" testID="payment-amount" />

        {cross ? (
          <Card>
            <Field label={`Kur: 1 ${cur} = ? ${account!.currency}`} value={rate} onChangeText={v => setRate(formatAmountInput(v, 4))} keyboardType="decimal-pad" testID="payment-rate" />
            <T variant="small">
              Cariye kaydedilecek: <T variant="small" style={{ fontWeight: '700' }}>{money(recorded, cur)}</T>
              {rates.data ? '' : ' (TCMB kuru alınamadı, kuru elle girin)'}
            </T>
          </Card>
        ) : null}

        <Field label="Tarih (YYYY-AA-GG)" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Field label="Açıklama" value={notes} onChangeText={setNotes} placeholder="İsteğe bağlı" multiline style={{ minHeight: 70, paddingTop: 12 }} />

        {error ? <T color={c.danger} testID="payment-error">{error}</T> : null}
        <Button title={`${k === 'customer' ? 'Tahsilatı' : 'Ödemeyi'} kaydet${recorded > 0 ? ` · ${fmt(recorded)} ${cur}` : ''}`} onPress={save} loading={saving} testID="payment-save" />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  dropdown: { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  dropdownHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
