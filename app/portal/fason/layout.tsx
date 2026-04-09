'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import FasonPortalShell from './components/fason-portal-shell';

export default function FasonPortalLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user as any;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
      router.replace('/portal/fason/login');
    }
  }, [session, status, user, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!session || user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return null;
  }

  return <FasonPortalShell>{children}</FasonPortalShell>;
}
