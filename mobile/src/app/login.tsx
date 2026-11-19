import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, Segmented, T } from '@/components/ui';
import { WEB_URL } from '@/core/config';
import { useAuth } from '@/core/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function Login() {
  const c = useTheme();
  const { signIn } = useAuth();
  const [kind, setKind] = useState<'staff' | 'portal'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { setError('E-posta ve şifrenizi girin.'); return; }
    setBusy(true); setError('');
    try {
      await signIn(email, password, kind);
    } catch (e: any) {
      setError(e?.message || 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: c.primary }]}>
            <T variant="title" color="#fff">S</T>
          </View>
          <T variant="title">SoleCost</T>
          <T variant="small">Taban üretiminde maliyet, cari ve stok</T>
        </View>

        <Segmented
          value={kind}
          onChange={v => { setKind(v); setError(''); }}
          options={[{ value: 'staff', label: 'Firma girişi' }, { value: 'portal', label: 'Müşteri portalı' }]}
        />

        <View style={{ gap: Spacing.three }}>
          <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" textContentType="username" returnKeyType="next" testID="login-email" />
          <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
            textContentType="password" returnKeyType="go" onSubmitEditing={submit} testID="login-password" />
          {error ? <T color={c.danger} testID="login-error">{error}</T> : null}
          <Button title="Giriş yap" onPress={submit} loading={busy} testID="login-submit" />
        </View>

        <View style={styles.links}>
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)} accessibilityRole="link">
            <T color={c.primary}>Şifremi unuttum</T>
          </Pressable>
          {/* App Store 3.1.1: abonelik satılan siteye kayıt bağlantısı verilmez; yalnızca mevcut hesapla giriş */}
          {kind === 'staff' ? (
            <T variant="small" style={{ textAlign: 'center' }}>SoleCost firma hesabınızla giriş yapın.</T>
          ) : (
            <T variant="small" style={{ textAlign: 'center' }}>Portal hesabınızı çalıştığınız firma açar.</T>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { alignItems: 'center', gap: Spacing.one },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  links: { alignItems: 'center', gap: Spacing.three },
});
