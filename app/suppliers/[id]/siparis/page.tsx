'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from '@/app/components/icons';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import OrderCatalog from '@/app/components/order-catalog';

// Bağlı SoleCost tedarikçisine sipariş: tedarikçinin kataloğu, sepet, gönder
export default function SupplierOrderPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params?.id as string;
  const [link, setLink] = useState<{ id: string; status: string; sellerCompany: { name: string } } | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/network/links?supplierId=${supplierId}`)
      .then(r => r.json())
      .then(d => setLink(d?.asBuyer?.[0] ?? null))
      .catch(() => setLink(null));
  }, [supplierId]);

  return (
    <AppShell>
      <div className="space-y-4">
        <BackLink href={`/suppliers/${supplierId}`} label="Tedarikçi" />
        {link === undefined ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : !link || link.status !== 'ACTIVE' ? (
          <div className="bg-white rounded-xl p-8 text-center text-ink-500 shadow-card border border-ink-200/80">
            Bu tedarikçiyle onaylı bir SoleCost bağlantısı yok. Tedarikçi sayfasından firma koduyla bağlantı isteği gönderebilirsiniz.
          </div>
        ) : (
          <OrderCatalog
            title={`${link.sellerCompany.name} · Sipariş`}
            catalogUrl={`/api/network/links/${link.id}/catalog`}
            orderUrl={`/api/network/links/${link.id}/orders`}
            onSubmitted={o => router.push(`/verilen-siparisler/${o.id}`)}
            solesUrl={`/api/network/links/${link.id}/soles`}
            mapUrl={`/api/network/links/${link.id}/material-map`}
          />
        )}
      </div>
    </AppShell>
  );
}
