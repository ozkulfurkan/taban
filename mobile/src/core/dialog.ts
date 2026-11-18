import { Alert, Platform } from 'react-native';

/** Onay sorusu (native: sistem uyarısı, web önizlemesi: tarayıcı onayı) */
export function confirm(title: string, message: string, ok = 'Tamam', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Bilgi / hata mesajı */
export function notify(title: string, message = '') {
  if (Platform.OS === 'web') { globalThis.alert?.(message ? `${title}\n\n${message}` : title); return; }
  Alert.alert(title, message);
}
