'use client';

import AppShell from '@/app/components/app-shell';
import NotificationList from '@/app/components/notification-list';

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationList portal={false}
        texts={{ title: 'Bildirimler', empty: 'Henüz bildirim yok', markAll: 'Tümünü okundu yap', more: 'Daha fazla göster' }} />
    </AppShell>
  );
}
