import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Button, Card, ErrorState, Field, Loading, Screen, T } from '@/components/ui';
import { formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { round2 } from '@shared/money';
import type { Account } from '@/core/accounts';

type Kind = 'giris' | 'cikis' | 'transfer';
const TITLE: Record<Kind, string> = { giris: 'Para Girişi', cikis: 'Para Çıkışı', transfer: 'Transfer' };

// Hesaba para girişi / çıkışı ve hesaplar arası transfer. Kayıtlar web ile aynı biçimde
// /api/payments'a yazılır (transfer: kaynak hesapta çıkış + hedef hesapta giriş).
export default function AccountOperation() {
  const c = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const kind: Kind = params.type === 'cikis' || params.type === 'transfer' ? params.type : 'giris';
  const accounts = useApi<Account[]>('/api/accounts');

  const [amount, setAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [date, setDate] = useState(isoDay());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (accounts.isLoading) return <><Stack.Screen options={{ title: TITLE[kind] }} /><Loading /></>;
  const source = accounts.data?.find(a => a.id === params.id);
  if (accounts.error || !source) return <><Stack.Screen options={{ title: TITLE[kind] }} /><ErrorState message={(accounts.error as Error)?.message || 'Hesap bulunamadı'} /></>;
  const others = (accounts.data ?? []).filter(a => a.id !== source.id);
  const target = others.find(a => a.id === targetId) ?? null;
  const cross = kind === 'transfer' && !!target && target.currency !== source.currency;
  const amt = parseAmountInput(amount);
  const tAmt = parseAmountInput(targetAmount);

  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Tutar girin.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Tarih seçin.');
    if (kind === 'transfer' && !target) return setError('Hedef hesabı seçin.');
    if (cross && !(tAmt > 0)) return setError(`Hedef hesaba geçecek ${target!.currency} tutarını girin.`);
    setSaving(true);
    try {
      if (kind === 'transfer') {
        const base = notes.trim() ? `Transfer — ${notes.trim()}` : 'Transfer';
        await api('/api/payments', { method: 'POST', body: { accountId: source.id, amount: round2(amt), date, method: 'Transfer', notes: `${base} → ${target!.name}`, _type: 'PAID' } });
        await api('/api/payments', { method: 'POST', body: { accountId: target!.id, amount: round2(cross ? tAmt : amt), date, method: 'Transfer', notes: `${base} ← ${source.name}`, _type: 'RECEIVED' } });
      } else {
        await api('/api/payments', {
          method: 'POST',
          body: { accountId: source.id, amount: round2(amt), date, notes: notes.trim() || null, method: TITLE[kind], _type: kind === 'giris' ? 'RECEIVED' : 'PAID' },
        });
      }
      await qc.invalidateQueries();
      router.back();
      notify(`${TITLE[kind]} kaydedildi`, `${money(amt, source.currency)} — ${source.name}`);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: TITLE[kind] }} />
      <Screen>
        <Card>
          <T variant="label">{kind === 'giris' ? 'Paranın girdiği hesap' : 'Paranın çıktığı hesap'}</T>
          <T style={{ fontWeight: '600' }}>{source.name}</T>
          <T variant="small">Bakiye {money(source.balance, source.currency)}</T>
        </Card>

        {kind === 'transfer' ? (
          <View style={{ gap: 8 }}>
            <T variant="label">Hedef hesap</T>
            <View style={[styles.dropdown, { borderColor: targetOpen ? c.primary : c.border, backgroundColor: c.card }]}>
              <Pressable onPress={() => setTargetOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: targetOpen }} style={styles.head} testID="transfer-target">
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={{ fontWeight: '600' }} color={target ? c.text : c.primary} numberOfLines={1}>{target ? target.name : 'Hesap seçin'}</T>
                  {target ? <T variant="small">{target.type} · {target.currency}</T> : null}
                </View>
                <T color={c.primary} style={{ fontSize: 16 }}>{targetOpen ? '▲' : '▼'}</T>
              </Pressable>
              {targetOpen ? others.map(a => (
                <Pressable key={a.id} onPress={() => { setTargetId(a.id); setTargetOpen(false); }} accessibilityRole="radio" accessibilityState={{ selected: a.id === targetId }}
                  style={({ pressed }) => [styles.option, { borderTopColor: c.border, backgroundColor: a.id === targetId ? c.primarySoft : 'transparent' }, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={{ fontWeight: '600' }} numberOfLines={1}>{a.name}</T>
                    <T variant="small">{a.type} · {a.currency}</T>
                  </View>
                  <T variant="small">{money(a.balance, a.currency)}</T>
                </Pressable>
              )) : null}
            </View>
          </View>
        ) : null}

        <Field label={`Tutar (${source.currency})`} value={amount} onChangeText={v => setAmount(formatAmountInput(v))} keyboardType="decimal-pad" placeholder="0,00" testID="op-amount" />
        {cross ? (
          <Field label={`Hedef hesaba geçen tutar (${target!.currency})`} value={targetAmount} onChangeText={v => setTargetAmount(formatAmountInput(v))}
            keyboardType="decimal-pad" placeholder="0,00" testID="op-target-amount" />
        ) : null}
        <DateField label="Tarih" value={date} onChange={setDate} />
        <Field label="Açıklama" value={notes} onChangeText={setNotes} placeholder="İsteğe bağlı" multiline style={{ minHeight: 70, paddingTop: 12 }} />

        {error ? <T color={c.danger} testID="op-error">{error}</T> : null}
        <Button title={`Kaydet${amt > 0 ? ` · ${money(amt, source.currency)}` : ''}`} onPress={save} loading={saving} testID="op-save" />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  dropdown: { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
