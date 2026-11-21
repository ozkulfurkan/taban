import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorState, Field, Loading, Screen, T } from '@/components/ui';
import { api } from '@/core/api';
import { useAuth } from '@/core/auth';
import { confirm, notify } from '@/core/dialog';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

type Info = { scope: 'company' | 'user' | null; companyName: string | null; email: string };

// Hesap silme: e-postaya gelen kodla onaylanır → hesap pasife alınır → 15 gün içinde giriş yapılmazsa tamamen silinir.
export default function DeleteAccount() {
  const c = useTheme();
  const { signOut } = useAuth();
  const info = useApi<Info>('/api/account/deletion');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (info.isLoading) return <><Stack.Screen options={{ title: 'Hesabı sil' }} /><Loading /></>;
  if (info.error || !info.data) {
    return <><Stack.Screen options={{ title: 'Hesabı sil' }} /><ErrorState message={(info.error as Error)?.message || 'Yüklenemedi'} onRetry={() => info.refetch()} /></>;
  }
  const { scope, companyName } = info.data;
  const company = scope === 'company';

  const request = async () => {
    setBusy(true); setError('');
    try {
      const r = await api<{ email: string }>('/api/account/deletion', { method: 'POST', body: { step: 'request' } });
      setSentTo(r.email);
    } catch (e: any) { setError(e?.message || 'Kod gönderilemedi'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (code.replace(/\D/g, '').length !== 6) { setError('E-postanıza gelen 6 haneli kodu girin.'); return; }
    const ok = await confirm(
      company ? 'Firma hesabı silinsin mi?' : 'Hesabınız silinsin mi?',
      company
        ? `${companyName ?? 'Firma'} ve tüm verileri (kullanıcılar dahil) 15 gün sonra kalıcı olarak silinir. Bu süre içinde giriş yaparsanız silme iptal olur.`
        : 'Hesabınız 15 gün sonra kalıcı olarak silinir. Bu süre içinde giriş yaparsanız silme iptal olur.',
      'Hesabı sil', true,
    );
    if (!ok) return;
    setBusy(true); setError('');
    try {
      await api('/api/account/deletion', { method: 'POST', body: { step: 'confirm', code } });
      notify('Hesabınız pasif duruma alındı', '15 gün içinde tekrar giriş yapmazsanız hesabınız tamamen silinecek. Bilgilendirme e-postası gönderildi.', 'info');
      await signOut();
    } catch (e: any) { setError(e?.message || 'Onaylanamadı'); setBusy(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Hesabı sil' }} />
      <Screen>
        {scope === null ? (
          <Card><T>Platform yöneticisi hesabı uygulamadan silinemez.</T></Card>
        ) : (
          <>
            <Card style={{ backgroundColor: c.dangerSoft, borderColor: c.dangerSoft }} testID="delete-warning">
              <T style={{ fontWeight: '700' }} color={c.danger}>
                {company ? `${companyName ?? 'Firma'} firma hesabı silinecek` : 'Kullanıcı hesabınız silinecek'}
              </T>
              <T variant="small">
                {company
                  ? 'Firma sahibi olduğunuz için firmaya ait tüm kayıtlar (cariler, belgeler, stok, siparişler, personel) ve firmanın tüm kullanıcıları silinir.'
                  : 'Yalnızca sizin kullanıcı hesabınız silinir; firmanın kayıtları firmada kalır.'}
              </T>
            </Card>
            <View style={{ gap: 6 }}>
              <T variant="small">1. E-postanıza 6 haneli onay kodu gönderilir.</T>
              <T variant="small">2. Kodu girince hesap pasif duruma alınır ve oturumunuz kapanır.</T>
              <T variant="small">3. 15 gün içinde tekrar giriş yapmazsanız hesap kalıcı olarak silinir. Vazgeçerseniz giriş yapmanız yeterli.</T>
            </View>

            {sentTo ? (
              <>
                <T>Kod <T style={{ fontWeight: '700' }}>{sentTo}</T> adresine gönderildi.</T>
                <Field label="Onay kodu" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}
                  textContentType="oneTimeCode" autoComplete="one-time-code" testID="delete-code" />
                {error ? <T color={c.danger} testID="delete-error">{error}</T> : null}
                <Button title="Hesabımı sil" variant="danger" icon="trash" onPress={submit} loading={busy} testID="delete-confirm" />
                <Button title="Kodu tekrar gönder" variant="ghost" onPress={request} disabled={busy} />
              </>
            ) : (
              <>
                {error ? <T color={c.danger} testID="delete-error">{error}</T> : null}
                <Button title="Onay kodu gönder" variant="danger" onPress={request} loading={busy} testID="delete-request" />
              </>
            )}
          </>
        )}
      </Screen>
    </>
  );
}
