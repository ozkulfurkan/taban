import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';

import { Badge, Button, Card, ErrorState, Loading, Screen, T } from '@/components/ui';
import { WEB_URL } from '@/core/config';
import { notify } from '@/core/dialog';
import { formatDate } from '@/core/format';
import {
  isCancelled, loadPackages, purchase, purchasesAvailable, restore, subscriptionSummary, useAfterPurchase, useSubscription,
} from '@/core/subscription';
import { useTheme } from '@/hooks/use-theme';

// App Store 3.1.2: fiyat, süre, otomatik yenileme, koşullar/gizlilik bağlantıları ve geri yükleme ekranda olmalı
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

export default function Abonelik() {
  const c = useTheme();
  const q = useSubscription();
  const afterPurchase = useAfterPurchase();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const s = q.data;
  const canBuy = !!s && s.canPurchase && s.kind !== 'lifetime' && purchasesAvailable;

  useEffect(() => {
    if (!canBuy || !s) return;
    loadPackages(s.companyId).then(setPackages).catch(e => setLoadError(e?.message || 'Abonelik seçenekleri yüklenemedi'));
  }, [canBuy, s?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <><Stack.Screen options={{ title: 'Abonelik' }} /><Loading /></>;
  if (q.error || !s) return <><Stack.Screen options={{ title: 'Abonelik' }} /><ErrorState message={(q.error as Error)?.message || 'Yüklenemedi'} onRetry={() => { void q.refetch(); }} /></>;

  const buy = async (pkg: PurchasesPackage) => {
    setBusy(pkg.identifier);
    try {
      await purchase(s.companyId, pkg);
      await afterPurchase();
      notify('Aboneliğiniz başladı', 'Teşekkürler! Tüm özellikler web ve mobilde açıldı.');
    } catch (e: any) {
      if (!isCancelled(e)) notify('Satın alma tamamlanamadı', e?.message ?? '');
    } finally {
      setBusy(null);
    }
  };
  const doRestore = async () => {
    setBusy('restore');
    try {
      await restore(s.companyId);
      await afterPurchase();
      notify('Satın alımlar geri yüklendi', 'Aktif aboneliğiniz varsa firmanıza tanımlandı.');
    } catch (e: any) {
      notify('Geri yüklenemedi', e?.message ?? '');
    } finally {
      setBusy(null);
    }
  };

  // Yıllıkta tasarruf: 12 × aylık fiyata göre
  const monthly = packages?.find(p => p.packageType === PACKAGE_TYPE.MONTHLY);
  const annual = packages?.find(p => p.packageType === PACKAGE_TYPE.ANNUAL);
  const saving = monthly && annual && monthly.product.price > 0
    ? Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100) : 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Abonelik' }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <Card style={{ backgroundColor: c.strong, borderColor: c.strong, gap: 6 }} testID="subscription-status">
          <T variant="small" color={c.strongText} style={{ opacity: 0.75 }}>SoleCost Pro</T>
          <T variant="heading" color={c.strongText}>{subscriptionSummary(s, formatDate)}</T>
          {s.kind === 'expired' ? (
            <T variant="small" color={c.strongText} style={{ opacity: 0.85 }}>
              Kayıtlarınızı görebilir, ekstre ve PDF alabilirsiniz. Yeni kayıt eklemek ve değiştirmek için abone olun.
            </T>
          ) : null}
          <View style={{ flexDirection: 'row' }}><Badge label={s.active ? 'Aktif' : 'Salt okunur'} tone={s.active ? 'success' : 'danger'} /></View>
        </Card>

        <View style={{ gap: 6 }}>
          <T style={{ fontWeight: '700' }}>Abonelikle neler açık?</T>
          {['Satış, alış, tahsilat ve ödeme kaydı', 'Sipariş, sevkiyat ve firma ağı', 'Çek ve kasa işlemleri, stok ve personel', 'Web (solecost.com) ve mobilde aynı abonelik, firmadaki tüm kullanıcılar']
            .map(t => <T key={t} variant="small">• {t}</T>)}
        </View>

        {s.kind === 'lifetime' ? (
          <Card><T>Firmanız süresiz kullanım hakkına sahip; abonelik gerekmez.</T></Card>
        ) : !s.canPurchase ? (
          <Card><T>Aboneliği firma sahibi ya da yöneticisi başlatabilir.</T></Card>
        ) : !purchasesAvailable ? (
          <Card><T variant="small">Satın alma bu sürümde kullanılamıyor. App Store’dan indirilen uygulamada abone olabilirsiniz.</T></Card>
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : packages === null ? (
          <Loading />
        ) : packages.length === 0 ? (
          <Card><T variant="small">Şu anda satışta abonelik yok. Lütfen daha sonra tekrar deneyin.</T></Card>
        ) : (
          <View style={{ gap: 12 }}>
            {packages.map(p => {
              const yearly = p.packageType === PACKAGE_TYPE.ANNUAL;
              return (
                <Card key={p.identifier} style={[styles.plan, yearly && { borderColor: c.primary, borderWidth: 2 }]} testID={`plan-${p.packageType}`}>
                  <View style={styles.between}>
                    <T style={{ fontWeight: '700', fontSize: 17 }}>{yearly ? 'Yıllık' : 'Aylık'}</T>
                    {yearly && saving > 0 ? <Badge label={`%${saving} tasarruf`} tone="success" /> : null}
                  </View>
                  <T variant="moneyLarge">{p.product.priceString}<T variant="small"> / {yearly ? 'yıl' : 'ay'}</T></T>
                  <Button title={s.kind === 'pro' ? 'Bu plana geç' : 'Abone ol'} onPress={() => { void buy(p); }}
                    loading={busy === p.identifier} disabled={!!busy} variant={yearly ? 'primary' : 'secondary'} />
                </Card>
              );
            })}
          </View>
        )}

        {canBuy ? (
          <Button title="Satın alımları geri yükle" variant="ghost" onPress={() => { void doRestore(); }} loading={busy === 'restore'} disabled={!!busy} testID="subscription-restore" />
        ) : null}

        <T variant="small" style={{ textAlign: 'center' }}>
          Abonelik, dönem bitiminden en az 24 saat önce iptal edilmezse aynı süre ve fiyatla otomatik yenilenir.
          Ödeme Apple ID hesabınızdan alınır. Aboneliğinizi App Store hesap ayarlarından yönetebilir ve iptal edebilirsiniz.
        </T>
        <View style={styles.links}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link"><T variant="small" color={c.primary}>Kullanım Koşulları</T></Pressable>
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/gizlilik`)} accessibilityRole="link"><T variant="small" color={c.primary}>Gizlilik Politikası</T></Pressable>
          <Pressable onPress={() => Linking.openURL(MANAGE_URL)} accessibilityRole="link"><T variant="small" color={c.primary}>Aboneliği yönet</T></Pressable>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  plan: { gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16 },
});
