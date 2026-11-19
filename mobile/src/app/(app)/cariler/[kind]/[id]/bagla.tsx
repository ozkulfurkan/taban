import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

// Mevcut tedarikçiyi SoleCost firma koduyla bağlama: istek satıcıya gider, onaylayınca sipariş verilebilir
export default function LinkSupplier() {
  const c = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const supplier = useApi<{ name: string }>(`/api/suppliers/${id}`);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const send = async () => {
    setError('');
    // Sunucu "sc 7k4p9q", "7K4P9Q" gibi yazımları da kabul eder; burada yalnızca boşluğu ve uzunluğu denetle
    const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^SC/, '');
    if (raw.length !== 6) return setError('Firma kodu SC- ile başlayan 6 karakterdir (örn. SC-7K4P9Q).');
    setSaving(true);
    try {
      const r = await api<{ link: { status: string; sellerName: string } }>('/api/network/links', { method: 'POST', body: { code, supplierId: id } });
      await qc.invalidateQueries();
      router.back();
      notify(
        r.link.status === 'ACTIVE' ? 'Zaten bağlısınız' : 'Bağlantı isteği gönderildi',
        r.link.status === 'ACTIVE' ? `${r.link.sellerName} ile bağlantınız aktif.` : `${r.link.sellerName} onaylayınca SoleCost üzerinden sipariş verebilirsiniz.`,
      );
    } catch (e: any) {
      setError(e?.message || 'İstek gönderilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Firma koduyla bağla' }} />
      <Screen>
        <Card>
          <T variant="label">Tedarikçi</T>
          <T style={{ fontWeight: '600' }}>{supplier.data?.name ?? '…'}</T>
        </Card>
        <T variant="small">
          Tedarikçiniz SoleCost kullanıyorsa firma kodunu ondan isteyin (kendi uygulamasında Firma Ağı ekranında görünür).
          İstek onaylanınca bu tedarikçinin kataloğundan sipariş verebilirsiniz.
        </T>
        <Field label="SoleCost firma kodu" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
          placeholder="SC-XXXXXX" returnKeyType="send" onSubmitEditing={send} testID="link-code" />
        {error ? <T color={c.danger} testID="link-error">{error}</T> : null}
        <Button title="Bağlantı isteği gönder" icon="send" onPress={send} loading={saving} testID="link-send" />
      </Screen>
    </>
  );
}
