import Constants from 'expo-constants';
import { Linking, Switch, View } from 'react-native';

import { Button, Card, ListRow, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { useBiometric } from '@/core/biometric';
import { WEB_URL } from '@/core/config';
import { confirm } from '@/core/dialog';
import { useTheme } from '@/hooks/use-theme';

const ROLE: Record<string, string> = { ADMIN: 'Yönetici', COMPANY_OWNER: 'Firma sahibi', EDITOR: 'Düzenleyici', VIEWER: 'Görüntüleyici' };

/** Firma ve portal kullanıcıları için ortak ayarlar içeriği */
export function SettingsBody() {
  const c = useTheme();
  const { user, signOut } = useAuth();
  const bio = useBiometric();

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
          <ListRow title="Hesap ve veri silme talebi" onPress={() => Linking.openURL(`${WEB_URL}/destek`)} />
        </Card>
      </Section>

      <Button title="Çıkış yap" variant="danger" icon="logout" onPress={logout} testID="logout" />
      <T variant="small" style={{ textAlign: 'center' }}>SoleCost {Constants.expoConfig?.version ?? ''}</T>
    </Screen>
  );
}
