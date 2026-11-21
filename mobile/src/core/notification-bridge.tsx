import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/core/auth';

// Bildirime dokununca ilgili ekran açılır (uygulama kapalıyken dokunulduysa oturum hazır olunca);
// uygulama açıkken bildirim gelince listeler yenilenir. Web'de bu dosyanın .web sürümü kullanılır.
export function NotificationBridge() {
  const { ready, user } = useAuth();
  const qc = useQueryClient();

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (!ready || !user || typeof url !== 'string' || !url.startsWith('/')) return;
    router.push(url as Href);
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, ready, user]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => { void qc.invalidateQueries(); });
    return () => sub.remove();
  }, [qc]);

  return null;
}
