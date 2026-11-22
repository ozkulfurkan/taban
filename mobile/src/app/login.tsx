import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { Button, Card, Field, ListRow, Segmented, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AccountChoice = { id: string; companyName: string; portalType: string };

export default function Login() {
  const c = useTheme();
  const { signIn } = useAuth();
  const [kind, setKind] = useState<'staff' | 'portal'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Aynı e-posta birden fazla firmanın portalında kayıtlıysa önce firma seçilir
  const [accounts, setAccounts] = useState<AccountChoice[] | null>(null);

  const submit = async (accountId?: string) => {
    if (!email.trim() || !password) { setError('E-posta ve şifrenizi girin.'); return; }
    setBusy(true); setError('');
    try {
      await signIn(email, password, kind, accountId);
    } catch (e: any) {
      if (e?.code === 'CHOOSE_ACCOUNT' && Array.isArray(e?.data?.accounts) && e.data.accounts.length) setAccounts(e.data.accounts);
      else setError(e?.message || 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  if (accounts) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={styles.wrap} testID="account-chooser">
          <View style={styles.brand}>
            <BrandMark size={56} />
            <T variant="title">Firma seçin</T>
            <T variant="small" style={{ textAlign: 'center' }}>Bu e-posta birden fazla firmanın portalında kayıtlı. Giriş yapmak istediğiniz firmayı seçin.</T>
          </View>
          <Card style={{ padding: 0, gap: 0 }}>
            {accounts.map(a => (
              <ListRow key={a.id} title={a.companyName} subtitle={a.portalType === 'SUBCONTRACTOR' ? 'Fasoncu portalı' : 'Müşteri portalı'}
                onPress={busy ? undefined : () => { void submit(a.id); }} testID={`choose-${a.id}`} />
            ))}
          </Card>
          {error ? <T color={c.danger} testID="login-error">{error}</T> : null}
          <Button title="Geri" variant="ghost" onPress={() => { setAccounts(null); setError(''); }} loading={busy} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <BrandMark size={64} />
          <T variant="title">SoleCost</T>
          <T variant="small">Ayakkabı sektöründe maliyet, cari ve stok</T>
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
            textContentType="password" returnKeyType="go" onSubmitEditing={() => { void submit(); }} testID="login-password" />
          {error ? <T color={c.danger} testID="login-error">{error}</T> : null}
          <Button title="Giriş yap" onPress={() => { void submit(); }} loading={busy} testID="login-submit" />
        </View>

        <View style={styles.links}>
          {kind === 'staff' ? (
            <>
              <Pressable onPress={() => router.push({ pathname: '/sifremi-unuttum', params: email.trim() ? { email: email.trim() } : {} })}
                accessibilityRole="link" testID="login-forgot">
                <T color={c.primary}>Şifremi unuttum</T>
              </Pressable>
              <Pressable onPress={() => router.push('/kayit')} accessibilityRole="link" testID="login-register">
                <T>Hesabınız yok mu? <T color={c.primary} style={{ fontWeight: '700' }}>Kayıt olun</T></T>
              </Pressable>
            </>
          ) : (
            // Portal hesabını ve şifresini satıcı firma yönetir
            <T variant="small" style={{ textAlign: 'center' }}>
              Portal hesabınızı çalıştığınız firma açar. Şifrenizi unuttuysanız firmadan yenilemesini isteyin.
            </T>
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
