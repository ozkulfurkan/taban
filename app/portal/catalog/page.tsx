'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalShell from '../components/portal-shell';
import { Loader2, Package, Plus } from 'lucide-react';

export default function PortalCatalogPage() {
  const { status } = useSession() || {};
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/portal/me/catalog')
      .then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status, router]);

  return (
    <PortalShell>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-slate-800">Ürün Kataloğu</h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Katalog henüz yüklenmedi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  {p.code && <p className="text-xs font-semibold text-blue-600 mb-0.5">{p.code}</p>}
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>}
                </div>
                <Link href={`/portal/orders/new?productId=${p.id}&productCode=${encodeURIComponent(p.code || '')}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Sipariş Ver
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
