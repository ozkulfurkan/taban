import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, Switch, View } from 'react-native';

import { Button, Card, ListRow, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { useBiometric } from '@/core/biometric';
import { WEB_URL } from '@/core/config';
import { confirm } from '@/core/dialog';
import { useLinks } from '@/core/network';
import { formatDate } from '@/core/format';
import { subscriptionSummary, useSubscription } from '@/core/subscription';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

const ROLE: Record<string, string> = { ADMIN: 'Yönetici', COMPANY_OWNER: 'Firma sahibi', EDITOR: 'Düzenleyici', VIEWER: 'Görüntüleyici' };

/** Firma aboneliğinin durumu: Abonelik ekranına açılır */
function SubscriptionRow() {
  const s = useSubscription();
  return (
    <Section title="Abonelik">
      <Card style={{ padding: 0, gap: 0 }}>
        <ListRow
          title="SoleCost Pro"
          subtitle={s.data ? subscriptionSummary(s.data, formatDate) : '…'}
          onPress={() => router.push('/abonelik')}
          testID="settings-subscription"
        />
      </Card>
    </Section>
  );
}

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

      {user?.type === 'staff' ? <SubscriptionRow /> : null}
      {user?.type === 'staff' ? <NetworkRow /> : null}

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
