'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PortalShell from '../components/portal-shell';
import OrderCatalog from '@/app/components/order-catalog';

export default function PortalCatalogPage() {
  const { status } = useSession() || {};
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/portal/login'); }, [status, router]);
  if (status !== 'authenticated') return <PortalShell><div /></PortalShell>;
  return (
    <PortalShell>
      <OrderCatalog catalogUrl="/api/portal/me/catalog" orderUrl="/api/portal/me/orders" onSubmitted={() => router.push('/portal/orders')} />
    </PortalShell>
  );
}
