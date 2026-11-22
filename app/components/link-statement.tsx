'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from '@/app/components/icons';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import { SharedStatement } from '@/app/components/shared-statement';

type Link = { id: string; status: string; name: string };

/**
 * Firma ağı: bağlı firmanın sizin için tuttuğu ekstre ("onların defterinde siz").
 * Tedarikçi sayfasından → tedarikçinin müşteri ekstresi; müşteri sayfasından → müşterinin tedarikçi ekstresi.
 */
export function LinkStatementPage({ kind, partyId }: { kind: 'supplier' | 'customer'; partyId: string }) {
  const [link, setLink] = useState<Link | null | undefined>(undefined);

  useEffect(() => {
    const q = kind === 'supplier' ? `supplierId=${partyId}` : `customerId=${partyId}`;
    fetch(`/api/network/links?${q}`)
      .then(r => r.json())
      .then(d => {
        const l = kind === 'supplier' ? d?.asBuyer?.[0] : d?.asSeller?.[0];
        setLink(l ? { id: l.id, status: l.status, name: kind === 'supplier' ? l.sellerCompany.name : l.buyerCompany.name } : null);
      })
      .catch(() => setLink(null));
  }, [kind, partyId]);

  const back = kind === 'supplier' ? `/suppliers/${partyId}` : `/customers/${partyId}`;
  return (
    <AppShell>
      <div className="space-y-4">
        <BackLink href={back} label={kind === 'supplier' ? 'Tedarikçi' : 'Müşteri'} />
        {link === undefined ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : !link || link.status !== 'ACTIVE' ? (
          <div className="bg-white rounded-xl p-8 text-center text-ink-500 shadow-card border border-ink-200/80" data-testid="link-statement-none">
            Bu cariyle onaylı bir SoleCost bağlantısı yok.
          </div>
        ) : (
          <>
            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-sm text-brand-900">
              <b>{link.name}</b> firmasının sizin için tuttuğu hesap ekstresi. Kendi kayıtlarınızla karşılaştırarak mutabakat yapabilirsiniz.
            </div>
            <SharedStatement
              embedded
              endpoint={`/api/network/links/${link.id}/statement`}
              footer={name => `Bu ekstre ${name} firmasının kayıtlarıdır ve SoleCost firma ağı bağlantısıyla gösterilmektedir.`}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
