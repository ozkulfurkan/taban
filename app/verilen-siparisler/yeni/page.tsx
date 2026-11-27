'use client';

// Yeni hammadde siparişi: SoleCost'ta bağlı (onaylı) tedarikçi seçilir, kataloğundan sipariş verilir.
// Tedarikçi sayfasına (bakiye, ekstre) girme yetkisi olmayan kullanıcılar (ör. usta) da buradan sipariş verir.
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import OrderCatalog from '@/app/components/order-catalog';
import { Loader2, Truck } from '@/app/components/icons';

type Link = { id: string; status: string; sellerCompany: { name: string } };

function NewMaterialOrder() {
  const router = useRouter();
  const sp = useSearchParams();
  const [links, setLinks] = useState<Link[] | null>(null);
  const [linkId, setLinkId] = useState(sp?.get('linkId') ?? '');
  useEffect(() => {
    fetch('/api/network/links').then(r => r.json())
      .then(d => setLinks(((d?.asBuyer ?? []) as Link[]).filter(l => l.status === 'ACTIVE')))
      .catch(() => setLinks([]));
  }, []);
  const link = links?.find(l => l.id === linkId);

  return (
    <div className="space-y-4">
      <BackLink href="/verilen-siparisler" label="Verilen Siparişler" />
      {links === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
      ) : !link ? (
        <div className="space-y-3">
          <h1 className="page-title">Yeni hammadde siparişi</h1>
          <p className="text-sm text-ink-500">Sipariş vereceğiniz tedarikçiyi seçin.</p>
          {links.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-ink-500 shadow-card border border-ink-200/80">
              SoleCost&apos;ta bağlı tedarikçiniz yok. Firma yöneticiniz tedarikçi sayfasından bağlantı isteği gönderebilir.
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="material-suppliers">
              {links.map(l => (
                <li key={l.id}>
                  <button type="button" onClick={() => setLinkId(l.id)}
                    className="w-full text-left bg-white rounded-xl p-4 shadow-card border border-ink-200/80 hover:border-brand-400 flex items-center gap-3">
                    <Truck className="w-5 h-5 text-brand-700" /><span className="font-semibold text-ink-800">{l.sellerCompany.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <OrderCatalog
          title={`${link.sellerCompany.name} · Hammadde siparişi`}
          catalogUrl={`/api/network/links/${link.id}/catalog`}
          orderUrl={`/api/network/links/${link.id}/orders`}
          onSubmitted={o => router.push(`/verilen-siparisler/${o.id}`)}
          solesUrl={`/api/network/links/${link.id}/soles`}
          mapUrl={`/api/network/links/${link.id}/material-map`}
        />
      )}
    </div>
  );
}

export default function Page() {
  return <AppShell><Suspense fallback={null}><NewMaterialOrder /></Suspense></AppShell>;
}
