import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, T } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/core/api';
import { WEB_URL } from '@/core/config';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PASSWORD_RULE_MESSAGE, passwordError } from '@shared/password';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Yeni firma hesabı (web /register ile aynı uç: /api/signup). Kayıttan sonra e-posta doğrulanmadan giriş yapılamaz.
export default function Register() {
  const c = useTheme();
  const [form, setForm] = useState({ name: '', companyName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !form.companyName.trim()) { setError('Ad soyad ve firma adını girin.'); return; }
    if (!EMAIL.test(email)) { setError('Geçerli bir e-posta adresi girin.'); return; }
    const pw = passwordError(form.password);
    if (pw) { setError(pw); return; }
    setBusy(true); setError('');
    try {
      await api('/api/signup', { method: 'POST', body: { name: form.name.trim(), companyName: form.companyName.trim(), email, password: form.password } });
      setDone(email);
    } catch (e: any) {
      setError(e?.message || 'Kayıt yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!done) return;
    setBusy(true);
    try { await api('/api/auth/resend-verification', { method: 'POST', body: { email: done } }); setResent(true); }
    catch (e: any) { setError(e?.message || 'Gönderilemedi'); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.wrap, { justifyContent: 'center' }]} testID="register-done">
          <View style={[styles.icon, { backgroundColor: c.primarySoft }]}>
            <Icon name="check" size={30} color={c.primary} />
          </View>
          <T variant="title" style={{ textAlign: 'center' }}>Hesabınız oluşturuldu</T>
          <T style={{ textAlign: 'center' }}>
            <T style={{ fontWeight: '700' }}>{done}</T> adresine doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.
          </T>
          <T variant="small" style={{ textAlign: 'center' }}>E-posta gelmediyse spam klasörünü kontrol edin.</T>
          {error ? <T color={c.danger} style={{ textAlign: 'center' }}>{error}</T> : null}
          <Button title="Giriş ekranına dön" onPress={() => router.replace('/login')} testID="register-to-login" />
          <Button title={resent ? 'Tekrar gönderildi' : 'Doğrulama e-postasını tekrar gönder'} variant="ghost"
            onPress={resend} loading={busy} disabled={resent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Geri" style={styles.back}>
            <Icon name="back" size={20} color={c.text} />
          </Pressable>
          <View style={{ gap: Spacing.one }}>
            <T variant="title">Hesap oluştur</T>
            <T variant="small">Firmanız için ücretsiz SoleCost hesabı açın.</T>
          </View>

          <View style={{ gap: Spacing.three }}>
            <Field label="Ad soyad" value={form.name} onChangeText={set('name')} autoComplete="name" textContentType="name" testID="register-name" />
            <Field label="Firma adı" value={form.companyName} onChangeText={set('companyName')} textContentType="organizationName" testID="register-company" />
            <Field label="E-posta" value={form.email} onChangeText={set('email')} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" textContentType="username" testID="register-email" />
            <View style={{ gap: 4 }}>
              <Field label="Şifre" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password"
                textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} testID="register-password" />
              <T variant="small">{PASSWORD_RULE_MESSAGE}</T>
            </View>
            {error ? <T color={c.danger} testID="register-error">{error}</T> : null}
            <Button title="Kayıt ol" onPress={submit} loading={busy} testID="register-submit" />
          </View>

          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/gizlilik`)} accessibilityRole="link">
            <T variant="small" style={{ textAlign: 'center' }}>
              Kayıt olarak <T variant="small" color={c.primary} style={{ textDecorationLine: 'underline' }}>Gizlilik Politikası ve KVKK Aydınlatma Metni</T>{"'ni kabul etmiş olursunuz."}
            </T>
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" style={{ alignSelf: 'center' }}>
            <T>Zaten hesabınız var mı? <T color={c.primary} style={{ fontWeight: '700' }}>Giriş yapın</T></T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: 440, alignSelf: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
