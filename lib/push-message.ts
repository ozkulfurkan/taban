// Anlık bildirim mesajı (saf modül, testli): Expo token denetimi ve 100'lük gönderim paketleri.

export type PushMessage = {
  title: string;
  body: string;
  /** Uygulamada bildirime dokununca açılacak ekran (expo-router yolu) */
  url?: string;
};

const CHUNK = 100;

/** Expo token biçimi: ExponentPushToken[...] / ExpoPushToken[...] */
export const isExpoToken = (t: unknown): t is string => typeof t === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);

/** Mesajları Expo'nun kabul ettiği gövdeye çevirir: geçersiz ve tekrar eden token'lar atılır, 100'lük paketler */
export function buildPushBatches(tokens: string[], msg: PushMessage) {
  const unique = Array.from(new Set(tokens.filter(isExpoToken)));
  const messages = unique.map(to => ({
    to, title: msg.title, body: msg.body, sound: 'default' as const, channelId: 'orders', priority: 'high' as const,
    data: msg.url ? { url: msg.url } : {},
  }));
  const batches: (typeof messages)[] = [];
  for (let i = 0; i < messages.length; i += CHUNK) batches.push(messages.slice(i, i + CHUNK));
  return batches;
}
