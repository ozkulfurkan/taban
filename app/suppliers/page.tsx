'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { Truck, Plus, Loader2, Search } from 'lucide-react';
import Link from 'next/link';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/suppliers')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Tedarikçiler</h1>
            <p className="text-slate-500 text-sm">{suppliers.length} tedarikçi</p>
          </div>
          <Link
            href="/suppliers/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Yeni Tedarikçi
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsim, e-posta veya telefon ara..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? 'Sonuç bulunamadı' : 'Henüz tedarikçi eklenmedi'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_140px] items-center px-4 py-2.5 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide">
              <span>İsim / Unvan</span>
              <span className="text-right">Borç Bakiye</span>
              <span className="text-right pr-1">Toplam Alış</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map(s => (
                <Link
                  key={s.id}
                  href={`/suppliers/${s.id}`}
                  className="grid grid-cols-[1fr_160px_140px] items-center hover:bg-slate-50 transition-colors group"
                >
                  {/* Name cell */}
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block bg-cyan-500 group-hover:bg-cyan-600 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors max-w-xs truncate">
                        {s.name}
                      </span>
                      {s.phone && (
                        <span className="inline-block bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                          {s.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right pr-4 py-2">
                    <span className={`text-sm font-semibold ${s.balance > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                      {(s.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Total purchased */}
                  <div className="text-right pr-4 py-2">
                    <span className="text-sm text-slate-500">
                      {(s.totalPurchased || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
