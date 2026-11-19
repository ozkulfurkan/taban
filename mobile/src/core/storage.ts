import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Oturum anahtarı cihazın güvenli deposunda (iOS Keychain / Android Keystore) tutulur.
// Web önizlemesinde güvenli depo olmadığından localStorage kullanılır.
const web = Platform.OS === 'web';

export const TOKEN_KEY = 'solecost.token';

export async function getItem(key: string): Promise<string | null> {
  if (web) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* yok say */ }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (web) {
    try { globalThis.localStorage?.removeItem(key); } catch { /* yok say */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
