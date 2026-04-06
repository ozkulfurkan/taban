'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import StatCard from '@/app/components/stat-card';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDate } from '@/lib/time';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Building2, Clock, Crown, Users, Package, Calculator, Loader2, Mail, Send, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminPage() {
  const { t } = useLanguage();
  const { data: session } = useSession() || {};
  const router = useRouter();
  const user = session?.user as any;
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [mailTest, setMailTest] = useState({ email: '', loading: false, result: null as any });

  useEffect(() => {
    if (user && user?.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    fetch('/api/admin/companies')
      .then((r) => r.json())
      .then((d) => setCompanies(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, router]);

  const handleImpersonate = async (companyId: string) => {
    setImpersonating(companyId);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (data.token) {
        router.push(`/impersonate?token=${data.token}`);
      }
    } catch (e) {
      console.error(e);
      setImpersonating(null);
    }
  };

  const handleMailTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTest.email) return;

    setMailTest(p => ({ ...p, loading: true, result: null }));

    try {
      const res = await fetch('/api/test-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mailTest.email }),
      });
      const result = await res.json();
      setMailTest(p => ({ ...p, loading: false, result }));
    } catch (error) {
      setMailTest(p => ({
        ...p,
        loading: false,
        result: { error: 'Network error', details: error instanceof Error ? error.message : 'Unknown error' }
      }));
    }
  };

  const totalCompanies = companies?.length ?? 0;
  const activeTrials = (companies ?? []).filter((c: any) => c?.subscriptionStatus === 'TRIAL')?.length ?? 0;
  const proSubs = (companies ?? []).filter((c: any) => c?.subscriptionStatus === 'PRO')?.length ?? 0;

  const statusColors: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-700',
    TRIAL: 'bg-amber-100 text-amber-700',
    PRO: 'bg-green-100 text-green-700',
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">{t('admin', 'title')}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title={t('admin', 'totalCompanies')} value={totalCompanies} icon={Building2} color="blue" />
          <StatCard title={t('admin', 'activeTrials')} value={activeTrials} icon={Clock} color="orange" />
          <StatCard title={t('admin', 'proSubscriptions')} value={proSubs} icon={Crown} color="green" />
        </div>

        {/* Mail Test Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-700">Mail Testi</h2>
          </div>

          <form onSubmit={handleMailTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Test Mail Adresi
              </label>
              <input
                type="email"
                value={mailTest.email}
                onChange={(e) => setMailTest(p => ({ ...p, email: e.target.value }))}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={mailTest.loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {mailTest.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {mailTest.loading ? 'Gönderiliyor...' : 'Test Maili Gönder'}
            </button>
          </form>

          {mailTest.result && (
            <div className={`mt-4 p-4 rounded-lg ${mailTest.result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              {mailTest.result.error ? (
                <div>
                  <p className="text-red-700 font-medium">❌ Mail gönderim hatası</p>
                  <p className="text-red-600 text-sm mt-1">{mailTest.result.details}</p>
                </div>
              ) : (
                <div>
                  <p className="text-green-700 font-medium">✅ Mail başarıyla gönderildi</p>
                  <p className="text-green-600 text-sm mt-1">{mailTest.result.message}</p>
                  <p className="text-green-600 text-sm">Environment: {mailTest.result.environment}</p>
                  <p className="text-green-600 text-sm">Timestamp: {mailTest.result.timestamp}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-slate-700">{t('admin', 'companies')}</h2>
            </div>
            <div className="divide-y">
              {(companies ?? []).map((company: any, i: number) => (
                <motion.div
                  key={company?.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{company?.name ?? '-'}</p>
                      <p className="text-xs text-slate-400">
                        {company?.createdAt ? formatDate(company.createdAt) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{company?._count?.users ?? 0}</span>
                      <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{company?._count?.materials ?? 0}</span>
                      <span className="flex items-center gap-1"><Calculator className="w-3.5 h-3.5" />{company?._count?.soleCalculations ?? 0}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[company?.subscriptionStatus] ?? statusColors.FREE}`}>
                      {company?.subscriptionStatus ?? 'FREE'}
                    </span>
                    {company?.trialEndsAt && (
                      <span className="text-xs text-slate-400">
                        {t('admin', 'trialEnds')}: {formatDate(company.trialEndsAt)}
                      </span>
                    )}
                    <button
                      onClick={() => handleImpersonate(company.id)}
                      disabled={impersonating === company.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {impersonating === company.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      Kullanıcı Gözünden Gör
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
