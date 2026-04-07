'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Users, Plus, Loader2, Search } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('customers', 'title')}</h1>
            <p className="text-slate-500 text-sm">{customers.length} {t('customers', 'title').toLowerCase()}</p>
          </div>
          <Link
            href="/customers/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> {t('customers', 'newCustomer')}
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('customers', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? t('customers', 'noResults') : t('customers', 'empty')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_140px] items-center px-4 py-2.5 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide">
              <span>{t('customers', 'nameTitle')}</span>
              <span className="text-right">{t('customers', 'openBalance')}</span>
              <span className="text-right pr-1">{t('customers', 'totalInvoiced')}</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map(c => (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="grid grid-cols-[1fr_160px_140px] items-center hover:bg-slate-50 transition-colors group"
                >
                  {/* Name cell */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="block w-full bg-cyan-500 group-hover:bg-cyan-600 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors truncate">
                      {c.name}
                    </span>
                    {c.phone && (
                      <span className="flex-shrink-0 bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                        {c.phone}
                      </span>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="text-right pr-4 py-2">
                    <span className={`text-sm font-semibold ${c.balance > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                      {(c.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Total invoiced */}
                  <div className="text-right pr-4 py-2">
                    <span className="text-sm text-slate-500">
                      {(c.totalInvoiced || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
