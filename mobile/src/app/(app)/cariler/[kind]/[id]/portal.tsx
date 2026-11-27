import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, Switch, View } from 'react-native';

import { Button, Card, ErrorState, Field, Loading, Screen, Section, T } from '@/components/ui';
import { api } from '@/core/api';
import { useAuth } from '@/core/auth';
import { WEB_URL } from '@/core/config';
import { afterDialog, confirm, notify } from '@/core/dialog';
import { inviteMessage } from '@/core/invite';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

type PortalAccount = { id: string; customerId: string | null; email: string; name: string | null; isActive: boolean; emailVerified: boolean; portalType: string };
type Customer = { id: string; name: string; email?: string | null };

const passwordOk = (p: string) => p.length >= 8 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) && /\d/.test(p);

// Müşteri portalı hesabı: aç, aktif/pasif yap, şifre sıfırla ve davet gönder.
export default function PortalAccountScreen() {
  const c = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useApi<Customer>(`/api/customers/${id}`);
  const accounts = useApi<PortalAccount[]>('/api/portal/customers');
  const acc = accounts.data?.find(a => a.customerId === id && a.portalType !== 'SUBCONTRACTOR');

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = { title: 'Portal hesabı' };

  if (customer.isLoading || accounts.isLoading) return <><Stack.Screen options={title} /><Loading /></>;
  if (customer.error || accounts.error || !customer.data) {
    return <><Stack.Screen options={title} /><ErrorState message={((customer.error || accounts.error) as Error)?.message || 'Yüklenemedi'} onRetry={() => { void customer.refetch(); void accounts.refetch(); }} /></>;
  }
  const cust = customer.data;
  const mail = email ?? cust.email ?? '';
  const companyName = user?.type === 'staff' ? user.companyName : null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['/api/portal/customers'] });
  const invite = async (portalEmail?: string, pw?: string) => {
    const msg = inviteMessage(WEB_URL, { companyName, customerName: cust.name, portalEmail });
    try {
      await Share.share({ message: pw ? msg.replace('Şifrenizi sizinle ayrıca paylaşacağız.', `Geçici şifreniz: ${pw}`) : msg });
    } catch (e: any) {
      notify('Paylaşılamadı', e?.message || 'Tekrar deneyin.', 'error');
    }
  };

  const create = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(mail.trim())) return setError('Geçerli bir e-posta girin.');
    if (!passwordOk(password)) return setError('Şifre en az 8 karakter, 1 harf ve 1 rakam içermelidir.');
    setBusy(true);
    try {
      const r = await api<{ emailSent?: boolean }>('/api/portal/auth/register', { method: 'POST', body: { customerId: id, email: mail.trim(), name: cust.name, password } });
      await refresh();
      const pw = password;
      const to = mail.trim();
      setPassword('');
      const text = r.emailSent === false
        ? `Hesap açıldı ama ${to} adresine doğrulama e-postası gönderilemedi. Davet mesajını mutlaka paylaşın.`
        : `${to} adresine doğrulama e-postası gönderildi. Davet mesajı şimdi paylaşılsın mı?`;
      // Paylaşım ekranı onay penceresi kapandıktan sonra açılır (iOS aksi halde açmaz)
      if (await confirm('Portal hesabı açıldı', text, 'Paylaş')) afterDialog(() => invite(to, pw));
    } catch (e: any) {
      setError(e?.message || 'Hesap açılamadı');
    } finally {
      setBusy(false);
    }
  };

  const update = async (body: { isActive?: boolean; newPassword?: string }) => {
    if (!acc) return;
    setError('');
    setBusy(true);
    try {
      await api(`/api/portal/customers/${acc.id}`, { method: 'PUT', body });
      await refresh();
      if (body.newPassword) {
        const pw = body.newPassword;
        setPassword('');
        if (await confirm('Şifre değiştirildi', 'Müşterinin açık oturumları kapatıldı. Yeni şifre davet mesajıyla paylaşılsın mı?', 'Paylaş')) afterDialog(() => invite(acc.email, pw));
      }
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={title} />
      <Screen>
        <T variant="heading">{cust.name}</T>
        {acc ? (
          <>
            <Card style={{ gap: 6 }}>
              <T variant="label">Giriş e-postası</T>
              <T testID="portal-email">{acc.email}</T>
              <T variant="small">{acc.emailVerified ? 'E-posta doğrulandı' : 'E-posta doğrulaması bekleniyor'}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>Hesap aktif</T>
                  <T variant="small">Pasif hesap giriş yapamaz ve bildirim almaz.</T>
                </View>
                <Switch value={acc.isActive} disabled={busy} onValueChange={v => { void update({ isActive: v }); }} trackColor={{ true: c.primary }} testID="portal-active" />
              </View>
            </Card>
            <Section title="Şifre sıfırla">
              <Field label="Yeni şifre" value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="off" testID="portal-new-password" />
              <Button title="Şifreyi değiştir" variant="secondary" loading={busy}
                onPress={() => { if (!passwordOk(password)) setError('Şifre en az 8 karakter, 1 harf ve 1 rakam içermelidir.'); else void update({ newPassword: password }); }} testID="portal-reset" />
            </Section>
            <Button title="Davet gönder" icon="link" onPress={() => { void invite(acc.email); }} testID="portal-invite" />
          </>
        ) : (
          <>
            <T variant="small">Müşteri portal hesabıyla sipariş verir, sipariş durumunu, ekstresini ve kataloğunuzu görür (web ve mobil).</T>
            <Card style={{ gap: 14 }}>
              <Field label="E-posta" value={mail} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="portal-new-email" />
              <Field label="Geçici şifre" value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="off" testID="portal-password" />
            </Card>
            <Button title="Portal hesabı aç" onPress={create} loading={busy} testID="portal-create" />
            <Button title="Hesap açmadan davet gönder" variant="secondary" icon="link" onPress={() => { void invite(); }} testID="portal-invite-only" />
          </>
        )}
        {error ? <T color={c.danger} testID="portal-error">{error}</T> : null}
      </Screen>
    </>
  );
}
