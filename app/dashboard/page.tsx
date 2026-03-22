'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import StatCard from '@/app/components/stat-card';
import { useLanguage } from '@/lib/i18n/language-context';
import { Package, Calculator, DollarSign, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const { t, formatCurrency } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const user = session?.user as any;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {t('dashboard', 'welcome')}, {user?.name ?? 'User'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">{user?.companyName ?? ''}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('dashboard', 'totalMaterials')}
            value={data?.materialCount ?? 0}
            icon={Package}
            color="blue"
          />
          <StatCard
            title={t('dashboard', 'totalCalculations')}
            value={data?.calcCount ?? 0}
            icon={Calculator}
            color="green"
          />
          <StatCard
            title={t('dashboard', 'avgCost')}
            value={data?.avgCost ?? 0}
            prefix="$"
            icon={DollarSign}
            color="purple"
            decimals={2}
          />
          <StatCard
            title={t('dashboard', 'thisMonth')}
            value={data?.recentCalcs?.length ?? 0}
            icon={TrendingUp}
            color="orange"
          />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Link href="/calculations/new" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-5 flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-blue-600/20 group">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">{t('common', 'newCalculation')}</p>
              <p className="text-blue-200 text-sm">{t('calculation', 'title')}</p>
            </div>
            <ArrowRight className="w-5 h-5 ml-auto group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/materials" className="bg-white hover:bg-slate-50 text-slate-800 rounded-xl p-5 flex items-center gap-4 transition-all hover:shadow-lg shadow-sm group border border-slate-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold">{t('materials', 'addMaterial')}</p>
              <p className="text-slate-500 text-sm">{t('materials', 'title')}</p>
            </div>
            <ArrowRight className="w-5 h-5 ml-auto text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Recent Calculations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">{t('dashboard', 'recentCalculations')}</h2>
            <Link href="/calculations" className="text-blue-600 text-sm font-medium hover:underline">
              {t('calculation', 'history')} →
            </Link>
          </div>
          {!data?.recentCalcs?.length ? (
            <p className="text-slate-400 text-sm py-8 text-center">{t('common', 'noData')}</p>
          ) : (
            <div className="space-y-3">
              {(data?.recentCalcs ?? []).map((calc: any, i: number) => (
                <Link
                  key={calc?.id ?? i}
                  href={`/calculations/${calc?.id}`}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{calc?.name ?? 'Calculation'}</p>
                    <p className="text-xs text-slate-400">{calc?.user?.name ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800 text-sm">{formatCurrency(calc?.totalCost ?? 0)}</p>
                    <p className="text-xs text-green-600">{formatCurrency(calc?.sellingPrice ?? 0)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
