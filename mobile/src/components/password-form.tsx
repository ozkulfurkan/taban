import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { notify } from '@/core/dialog';
import { useTheme } from '@/hooks/use-theme';

// Şifre değiştir (firma ve portal kullanıcısı): mevcut şifre + yeni şifre (iki kez).
// Diğer cihazlardaki açık oturumlar kapanır; bu cihazda oturum devam eder.
export function PasswordForm() {
  const c = useTheme();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!current) return setError('Mevcut şifrenizi girin.');
    if (next.length < 6 || !/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(next) || !/\d/.test(next)) return setError('Yeni şifre en az 6 karakter, 1 harf ve 1 rakam içermelidir.');
    if (next !== again) return setError('Yeni şifreler aynı değil.');
    setBusy(true);
    try {
      await changePassword(current, next);
      notify('Şifreniz değiştirildi', 'Diğer cihazlardaki oturumlar kapatıldı.', 'success');
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Şifre değiştirilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Şifre değiştir' }} />
      <Screen>
        <Card style={{ gap: 14 }}>
          <Field label="Mevcut şifre" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" testID="pw-current" />
          <Field label="Yeni şifre" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" testID="pw-new" />
          <Field label="Yeni şifre (tekrar)" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" textContentType="newPassword" testID="pw-again" onSubmitEditing={submit} />
          <T variant="small">En az 6 karakter, 1 harf ve 1 rakam.</T>
          {error ? <T color={c.danger} testID="pw-error">{error}</T> : null}
        </Card>
        <Button title="Şifreyi değiştir" onPress={submit} loading={busy} testID="pw-submit" />
      </Screen>
    </>
  );
}
