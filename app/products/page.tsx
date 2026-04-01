'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { BoxIcon, Plus, Trash2, Pencil, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function ProductsPage() {
  const { t, formatCurrency } = useLanguage();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" ${t('common', 'delete')}?`)) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('products', 'title')}</h1>
            <p className="text-slate-500 text-sm">{products.length} {t('products', 'title').toLowerCase()}</p>
          </div>
          <Link href="/products/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> {t('products', 'newProduct')}
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <BoxIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? t('products', 'noResults') : t('products', 'empty')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{t('products', 'productName')}</th>
                  <th className="px-4 py-3 text-left">{t('products', 'code')}</th>
                  <th className="px-4 py-3 text-left">{t('products', 'unit')}</th>
                  <th className="px-4 py-3 text-right">{t('products', 'unitPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('products', 'stock')}</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-blue-50/50 cursor-pointer"
                    onClick={() => router.push(`/products/${p.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{p.name}</p>
                      {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.code || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      {formatCurrency(p.unitPrice)}
                      <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${p.stock <= 0 ? 'text-red-500' : 'text-slate-700'}`}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
