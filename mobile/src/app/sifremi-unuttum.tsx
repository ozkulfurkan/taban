import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Button, Field, T } from '@/components/ui';
import { api } from '@/core/api';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Firma hesabı şifre sıfırlama: e-postaya sıfırlama bağlantısı gönderilir (web /forgot-password ile aynı uç).
// Bağlantı telefonun tarayıcısında açılır, yeni şifre orada belirlenir; sonra uygulamadan giriş yapılır.
export default function ForgotPassword() {
  const c = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) { setError('Geçerli bir e-posta adresi girin.'); return; }
    setBusy(true); setError('');
    try {
      const r = await api<{ message?: string }>('/api/auth/forgot-password', { method: 'POST', body: { email: e } });
      setSent(r?.message || 'Şifre sıfırlama bağlantısı e-posta olarak gönderildi.');
    } catch (err: any) {
      setError(err?.message || 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Geri" style={styles.back}>
          <Icon name="back" size={20} color={c.text} />
        </Pressable>
        <View style={{ gap: Spacing.one }}>
          <T variant="title">Şifremi unuttum</T>
          <T variant="small">Firma hesabınızın e-posta adresini girin; şifre sıfırlama bağlantısı gönderelim.</T>
        </View>

        {sent ? (
          <View style={{ gap: Spacing.three }} testID="forgot-sent">
            <View style={[styles.note, { backgroundColor: c.successSoft }]}>
              <Icon name="mail" color={c.success} />
              <T style={{ flex: 1 }}>{sent}</T>
            </View>
            <T variant="small">Bağlantıyı açıp yeni şifrenizi belirledikten sonra uygulamadan giriş yapabilirsiniz. Bağlantı 24 saat geçerlidir.</T>
            <Button title="Giriş ekranına dön" onPress={() => router.replace('/login')} testID="forgot-to-login" />
            <Button title="Tekrar gönder" variant="ghost" onPress={() => setSent(null)} />
          </View>
        ) : (
          <View style={{ gap: Spacing.three }}>
            <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" textContentType="username" returnKeyType="send" onSubmitEditing={submit} testID="forgot-email" />
            {error ? <T color={c.danger} testID="forgot-error">{error}</T> : null}
            <Button title="Sıfırlama bağlantısı gönder" onPress={submit} loading={busy} testID="forgot-submit" />
          </View>
        )}
        <View style={{ flex: 1 }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: 440, alignSelf: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: Spacing.three, borderRadius: 12 },
});
