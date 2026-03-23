'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Users, Plus, Trash2, Eye, Loader2, Search, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function CustomersPage() {
  const { formatCurrency } = useLanguage();
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" silinsin mi?`)) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Müşteriler</h1>
            <p className="text-slate-500 text-sm">{customers.length} müşteri</p>
          </div>
          <Link href="/customers/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Yeni Müşteri
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Müşteri ara..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? 'Sonuç bulunamadı' : 'Henüz müşteri eklenmedi'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{c.name}</p>
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-slate-400">
                      {c.email && <span>{c.email}</span>}
                      {c.phone && <span>{c.phone}</span>}
                      {c.taxId && <span>VKN: {c.taxId}</span>}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs">
                      <span className="text-slate-500">
                        Toplam Fatura: <strong className="text-slate-700">{formatCurrency(c.totalInvoiced)}</strong>
                      </span>
                      <span className="text-green-600">
                        Tahsilat: <strong>{formatCurrency(c.totalPaid)}</strong>
                      </span>
                      <span className={c.balance > 0 ? 'text-orange-600' : 'text-slate-500'}>
                        Bakiye: <strong>{formatCurrency(c.balance)}</strong>
                        {c.balance > 0 && <TrendingUp className="inline w-3 h-3 ml-1" />}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/customers/${c.id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
