import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

// Anlık bildirim: yeni sipariş (satıcıya) ve sipariş durumu değişikliği (siparişi verene).
// Giriş yapılınca cihazın Expo push token'ı sunucuya kaydedilir, çıkışta silinir.
// Bildirime dokununca data.url ile ilgili sipariş ekranı açılır (app/_layout.tsx).

// Uygulama açıkken de bildirim üstte görünsün
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registered: string | null = null;

/** İzin ister, token alır ve sunucuya bağlar. Simülatör / web / izin yok → sessizce null */
export async function registerForPush(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    // Android 13+: kanal olmadan izin penceresi çıkmaz ve token alınamaz
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Siparişler',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api('/api/mobile/push-token', { method: 'POST', body: { token, platform: Platform.OS } });
    registered = token;
    return token;
  } catch (e) {
    // Bildirim kaydı başarısız olsa da uygulama çalışmaya devam eder
    console.warn('push kaydı yapılamadı', e);
    return null;
  }
}

/** Çıkışta: bu cihaz artık bu hesaba bildirim almasın (oturum anahtarı silinmeden önce çağrılır) */
export async function unregisterPush() {
  const token = registered;
  registered = null;
  if (!token) return;
  try {
    await api('/api/mobile/push-token', { method: 'DELETE', body: { token } });
  } catch { /* oturum zaten düşmüş olabilir; sunucu token'ı yeni girişte yeniden bağlar */ }
}
