'use client';

// Portal müşterisi: hesabım — kendi şifresini değiştirir (mobilde Ayarlar → Şifre değiştir ile aynı uç).
import PortalShell from '@/app/portal/components/portal-shell';
import { ChangePasswordCard } from '@/app/components/change-password-card';
import { usePortalText } from '@/lib/i18n/portal';

export default function PortalAccountPage() {
  const { tp } = usePortalText();
  return (
    <PortalShell>
      <div className="space-y-4 max-w-2xl">
        <h1 className="page-title">{tp('Hesabım')}</h1>
        <ChangePasswordCard provider="portal-credentials" />
      </div>
    </PortalShell>
  );
}
