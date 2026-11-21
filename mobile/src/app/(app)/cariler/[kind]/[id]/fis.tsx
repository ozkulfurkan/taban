import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DateField } from '@/components/date-field';
import { Button, Card, ErrorState, Field, Loading, Screen, Segmented, T } from '@/components/ui';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { formatAmountInput, parseAmountInput } from '@/core/amount';
import { isoDay, money } from '@/core/format';
import { useApi } from '@/core/query';
import { feeNotes, feeEffect, type FeeKind } from '@/core/fee';
import type { PartyKind } from '@/core/statement';
import { useTheme } from '@/hooks/use-theme';
import { round2 } from '@shared/money';

type Party = { id: string; name: string; currency: string; balance: number };

// Borç / alacak fişi: kasa hareketi olmadan carinin bakiyesini düzeltir (web'deki fişle aynı kayıt:
// /api/payments, method 'Borç Fişi' | 'Alacak Fişi', vade notlarda "Vade:YYYY-AA-GG").
export default function Fis() {
  const c = useTheme();
  const qc = useQueryClient();
  const { kind, id, tip } = useLocalSearchParams<{ kind: PartyKind; id: string; tip?: string }>();
  const k: PartyKind = kind === 'supplier' ? 'supplier' : 'customer';
  const party = useApi<Party>(`/api/${k === 'customer' ? 'customers' : 'suppliers'}/${id}`);
  const [type, setType] = useState<FeeKind>(tip === 'Borç Fişi' ? 'Borç Fişi' : 'Alacak Fişi');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(isoDay());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (party.isLoading) return <><Stack.Screen options={{ title: 'Borç / alacak fişi' }} /><Loading /></>;
  if (party.error || !party.data) return <><Stack.Screen options={{ title: 'Borç / alacak fişi' }} /><ErrorState message={(party.error as Error)?.message || 'Cari bulunamadı'} /></>;
  const p = party.data;
  const cur = p.currency || 'TRY';
  const amt = round2(parseAmountInput(amount));

  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Tutar girin.');
    setSaving(true);
    try {
      await api('/api/payments', {
        method: 'POST',
        body: {
          [k === 'customer' ? 'customerId' : 'supplierId']: id,
          amount: amt,
          currency: cur,
          date: new Date().toISOString(),
          method: type,
          notes: feeNotes(due, notes),
        },
      });
      await qc.invalidateQueries();
      router.back();
      notify(`${type} kaydedildi`, `${money(amt, cur)} — ${p.name}`);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const after = round2(p.balance + feeEffect(type, amt));
  return (
    <>
      <Stack.Screen options={{ title: 'Borç / alacak fişi' }} />
      <Screen>
        <T variant="heading">{p.name}</T>
        <T variant="small">Güncel bakiye: {money(p.balance, cur)}</T>
        <Segmented<FeeKind>
          value={type}
          onChange={setType}
          options={[{ value: 'Alacak Fişi', label: 'Alacak fişi' }, { value: 'Borç Fişi', label: 'Borç fişi' }]}
        />
        <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primarySoft }}>
          <T variant="small" testID="fee-hint">
            {type === 'Borç Fişi'
              ? (k === 'customer' ? 'Müşterinin size borcu artar.' : 'Tedarikçiye borcunuz artar.')
              : (k === 'customer' ? 'Müşterinin size borcu azalır.' : 'Tedarikçiye borcunuz azalır.')}
            {amt > 0 ? ` Kayıttan sonra bakiye: ${money(after, cur)}` : ''}
          </T>
        </Card>
        <Field label={`Tutar (${cur})`} value={amount} onChangeText={v => setAmount(formatAmountInput(v))} keyboardType="decimal-pad" placeholder="0,00" testID="fee-amount" />
        <DateField label="Vade" value={due} onChange={setDue} />
        <Field label="Açıklama" value={notes} onChangeText={setNotes} placeholder="İsteğe bağlı" testID="fee-notes" />
        {error ? <T color={c.danger}>{error}</T> : null}
        <Button title="Kaydet" onPress={save} loading={saving} testID="fee-save" />
      </Screen>
    </>
  );
}
