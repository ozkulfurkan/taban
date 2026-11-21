import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, Switch, View } from 'react-native';

import { Sheet } from '@/components/sheet';

import { Button, Card, ListRow, Screen, Section, Segmented, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { useBiometric } from '@/core/biometric';
import { WEB_URL } from '@/core/config';
import { confirm, notify } from '@/core/dialog';
import { inviteMessage } from '@/core/invite';
import { pickImage, uploadCompanyLogo } from '@/core/product-image';
import { useIsManager, useLinks } from '@/core/network';
import { useThemePreference } from '@/core/theme-pref';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

const ROLE: Record<string, string> = { ADMIN: 'Yönetici', COMPANY_OWNER: 'Firma sahibi', EDITOR: 'Düzenleyici', VIEWER: 'Görüntüleyici' };

/** Firma kodu ve bekleyen bağlantı istekleri: Firma Ağı ekranına açılır (yalnızca firma kullanıcısında) */
function NetworkRow() {
  const code = useApi<{ code: string }>('/api/network/code');
  const links = useLinks();
  const pending = links.data?.asSeller.filter(l => l.status === 'PENDING').length ?? 0;
  return (
    <Section title="Firma ağı">
      <Card style={{ padding: 0, gap: 0 }}>
        <ListRow
          title={`Firma kodu: ${code.data?.code ?? '…'}`}
          subtitle={pending ? `${pending} bağlantı isteği bekliyor` : 'Kodu paylaşın, bağlantı isteklerini yönetin'}
          onPress={() => router.push('/baglantilar')}
          testID="settings-network"
        />
      </Card>
    </Section>
  );
}

/** Firma logosu: katalog PDF'i, ekstre ve teklif çıktılarında görünür (yalnızca firma sahibi / yönetici) */
function CompanyLogo() {
  const c = useTheme();
  const qc = useQueryClient();
  const company = useApi<{ logoUrl: string | null; name: string }>('/api/company');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const logo = company.data?.logoUrl;

  const save = async (source: 'camera' | 'library' | null) => {
    setBusy(true);
    try {
      if (source) {
        await new Promise(r => setTimeout(r, 400)); // seçenek penceresi kapanmadan iOS seçiciyi açmaz
        const img = await pickImage(source, { maxSide: 512, format: 'png', square: false });
        if (!img) return;
        await uploadCompanyLogo(img);
        notify('Logo güncellendi', 'Katalog ve ekstre çıktılarında kullanılacak.', 'success');
      } else {
        if (!(await confirm('Logo kaldırılsın mı?', 'Çıktılarda firma adının baş harfi görünür.', 'Kaldır', true))) return;
        await uploadCompanyLogo(null);
      }
      await qc.invalidateQueries({ queryKey: ['/api/company'] });
    } catch (e: any) {
      notify('Logo kaydedilemedi', e?.message || 'Tekrar deneyin.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Firma logosu">
      <Card onPress={() => setOpen(true)} testID="settings-logo" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 64, height: 64 }} contentFit="contain" /> : <T variant="title" color={c.primary}>{(company.data?.name ?? '?').slice(0, 1).toLocaleUpperCase('tr-TR')}</T>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '700' }} color={c.primary}>{busy ? 'Yükleniyor…' : logo ? 'Logoyu değiştir' : 'Logo yükle'}</T>
          <T variant="small">Katalog PDF&apos;i, ekstre ve tekliflerde görünür. PNG, JPEG ya da WebP.</T>
        </View>
      </Card>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Firma logosu"
        actions={[
          { label: 'Galeriden seç', icon: 'image', onPress: () => { void save('library'); }, testID: 'logo-library' },
          { label: 'Fotoğraf çek', icon: 'camera', onPress: () => { void save('camera'); }, testID: 'logo-camera' },
          ...(logo ? [{ label: 'Logoyu kaldır', icon: 'trash' as const, destructive: true, onPress: () => { void save(null); } }] : []),
        ]}
      />
    </Section>
  );
}

/** Firma ve portal kullanıcıları için ortak ayarlar içeriği */
export function SettingsBody() {
  const c = useTheme();
  const { user, signOut } = useAuth();
  const bio = useBiometric();
  const themePref = useThemePreference();
  const manager = useIsManager();

  const logout = async () => {
    if (await confirm('Çıkış yapılsın mı?', 'Tekrar girişte e-posta ve şifreniz istenir.', 'Çıkış yap', true)) await signOut();
  };

  return (
    <Screen>
      <Card>
        <T variant="heading">{user?.name || user?.email}</T>
        <T variant="small">{user?.email}</T>
        {user?.type === 'staff' ? (
          <T variant="small">{user.companyName} · {ROLE[user.role] ?? user.role}</T>
        ) : (
          <T variant="small">Müşteri portalı</T>
        )}
      </Card>

      {manager ? <CompanyLogo /> : null}

      <Section title="Hesap">
        <Card style={{ padding: 0, gap: 0 }}>
          <ListRow title="Şifre değiştir" subtitle="Mevcut şifrenizle yeni şifre belirleyin" onPress={() => router.push(user?.type === 'portal' ? '/portal-sifre' : '/ayarlar/sifre')} testID="settings-password" />
          {manager ? (
            <ListRow title="Kullanıcılar" subtitle="Firma kullanıcısı ekleyin, rol ve izinleri yönetin" onPress={() => router.push('/ayarlar/kullanicilar')} testID="settings-users" />
          ) : null}
          {user?.type === 'staff' ? (
            <ListRow title="Uygulamayı paylaş" subtitle="Müşterilerinize uygulama ve web bağlantısı gönderin"
              onPress={() => { void Share.share({ message: inviteMessage(WEB_URL, { companyName: user.companyName }) }); }} testID="settings-share" />
          ) : null}
        </Card>
      </Section>

      {user?.type === 'staff' ? <NetworkRow /> : null}

      <Section title="Görünüm">
        <Segmented
          value={themePref.pref}
          onChange={themePref.setPref}
          options={[{ value: 'light', label: 'Açık' }, { value: 'dark', label: 'Koyu' }, { value: 'system', label: 'Sistem' }]}
        />
      </Section>

      {bio.available ? (
        <Section title="Güvenlik">
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '600' }}>Face ID / parmak izi kilidi</T>
              <T variant="small">Uygulama arka plandan dönünce kimlik doğrulaması ister.</T>
            </View>
            <Switch value={bio.enabled} onValueChange={v => { void bio.setEnabled(v); }} trackColor={{ true: c.primary }} />
          </Card>
        </Section>
      ) : null}

      <Section title="Yardım">
        <Card style={{ padding: 0, gap: 0 }}>
          <ListRow title="Destek" onPress={() => Linking.openURL(`${WEB_URL}/destek`)} />
          <ListRow title="Gizlilik Politikası ve KVKK" onPress={() => Linking.openURL(`${WEB_URL}/gizlilik`)} />
          {user?.type === 'staff' ? (
            <ListRow title="Hesabımı sil" subtitle="E-posta koduyla onaylanır, 15 gün sonra silinir"
              onPress={() => router.push('/ayarlar/hesap-sil')} testID="settings-delete-account" />
          ) : (
            <ListRow title="Hesap ve veri silme talebi" subtitle="Portal hesabınızı firmanız yönetir" onPress={() => Linking.openURL(`${WEB_URL}/destek`)} />
          )}
        </Card>
      </Section>

      <Button title="Çıkış yap" variant="danger" icon="logout" onPress={logout} testID="logout" />
      <T variant="small" style={{ textAlign: 'center' }}>SoleCost {Constants.expoConfig?.version ?? ''}</T>
    </Screen>
  );
}
