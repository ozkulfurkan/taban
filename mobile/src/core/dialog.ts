import { Alert } from 'react-native';
import { toneOf, type Tone } from './tone';

export { toneOf, type Tone };

// Uygulama içi uyarılar: sistem uyarısı yerine uygulamanın temalı penceresi (components/dialog-host).
// Çağrı biçimi aynıdır: confirm(...) Promise<boolean>, notify(...) anında döner.
//  - Başarı mesajları ("… eklendi", "… kaydedildi") üstte kısa süreli bildirim olarak görünür.
//  - Hata / bilgi mesajları ve onay soruları ortada pencere olarak açılır.


export type DialogRequest =
  | { kind: 'confirm'; id: number; title: string; message: string; ok: string; destructive: boolean; resolve: (v: boolean) => void }
  | { kind: 'notify'; id: number; title: string; message: string; tone: Tone };

type Listener = (r: DialogRequest) => void;
let listener: Listener | null = null;
let seq = 0;

/** DialogHost bağlanır; bağlı değilse (ör. çok erken çağrı) sistem uyarısına düşülür */
export function setDialogListener(l: Listener | null) { listener = l; }

/** Onay sorusu */
export function confirm(title: string, message: string, ok = 'Tamam', destructive = false): Promise<boolean> {
  return new Promise(resolve => {
    if (!listener) {
      Alert.alert(title, message, [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
        { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
      return;
    }
    listener({ kind: 'confirm', id: ++seq, title, message, ok, destructive, resolve });
  });
}

/** Bilgi / hata / başarı mesajı (tür verilmezse başlıktan çıkarılır) */
export function notify(title: string, message = '', tone?: Tone) {
  if (!listener) { Alert.alert(title, message); return; }
  listener({ kind: 'notify', id: ++seq, title, message, tone: tone ?? toneOf(title) });
}
