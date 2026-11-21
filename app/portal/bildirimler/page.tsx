'use client';

import PortalShell from '../components/portal-shell';
import NotificationList from '@/app/components/notification-list';
import { usePortalText } from '@/lib/i18n/portal';

export default function PortalNotificationsPage() {
  const { tp } = usePortalText();
  return (
    <PortalShell>
      <NotificationList portal
        texts={{ title: tp('Bildirimler'), empty: tp('Henüz bildirim yok'), markAll: tp('Tümünü okundu yap'), more: tp('Daha fazla göster') }} />
    </PortalShell>
  );
}
