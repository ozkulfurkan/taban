'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import StatCard from '@/app/components/stat-card';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDate } from '@/lib/time';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Building2, Clock, Crown, Users, Package, Calculator, Loader2, Mail, Send, Eye } from '@/app/components/icons';
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
    FREE: 'bg-ink-100 text-ink-700',
    TRIAL: 'bg-amber-100 text-amber-700',
    PRO: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-brand-700" />
          <h1 className="page-title">{t('admin', 'title')}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title={t('admin', 'totalCompanies')} value={totalCompanies} icon={Building2} color="blue" />
          <StatCard title={t('admin', 'activeTrials')} value={activeTrials} icon={Clock} color="orange" />
          <StatCard title={t('admin', 'proSubscriptions')} value={proSubs} icon={Crown} color="green" />
        </div>

        {/* Mail Test Section */}
        <div className="bg-white rounded-xl shadow-card p-6 border border-ink-200/80">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-brand-700" />
            <h2 className="text-lg font-semibold text-ink-700">Mail Testi</h2>
          </div>

          <form onSubmit={handleMailTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-2">
                Test Mail Adresi
              </label>
              <input
                type="email"
                value={mailTest.email}
                onChange={(e) => setMailTest(p => ({ ...p, email: e.target.value }))}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                required
              />
            </div>

            <button
              type="submit"
              disabled={mailTest.loading}
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:bg-brand-500 text-white rounded-lg font-medium transition-colors"
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
            <div className={`mt-4 p-4 rounded-lg ${mailTest.result.error ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              {mailTest.result.error ? (
                <div>
                  <p className="text-red-700 font-medium">❌ Mail gönderim hatası</p>
                  <p className="text-red-600 text-sm mt-1">{mailTest.result.details}</p>
                </div>
              ) : (
                <div>
                  <p className="text-emerald-700 font-medium">✅ Mail başarıyla gönderildi</p>
                  <p className="text-emerald-600 text-sm mt-1">{mailTest.result.message}</p>
                  <p className="text-emerald-600 text-sm">Environment: {mailTest.result.environment}</p>
                  <p className="text-emerald-600 text-sm">Timestamp: {mailTest.result.timestamp}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-ink-700">{t('admin', 'companies')}</h2>
            </div>
            <div className="divide-y">
              {(companies ?? []).map((company: any, i: number) => (
                <motion.div
                  key={company?.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 flex items-center justify-between hover:bg-ink-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand-700" />
                    </div>
                    <div>
                      <p className="font-medium text-ink-700">{company?.name ?? '-'}</p>
                      <p className="text-xs text-ink-400">
                        {company?.createdAt ? formatDate(company.createdAt) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-xs text-ink-500">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{company?._count?.users ?? 0}</span>
                      <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{company?._count?.materials ?? 0}</span>
                      <span className="flex items-center gap-1"><Calculator className="w-3.5 h-3.5" />{company?._count?.soleCalculations ?? 0}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[company?.subscriptionStatus] ?? statusColors.FREE}`}>
                      {company?.subscriptionStatus ?? 'FREE'}
                    </span>
                    {company?.trialEndsAt && (
                      <span className="text-xs text-ink-400">
                        {t('admin', 'trialEnds')}: {formatDate(company.trialEndsAt)}
                      </span>
                    )}
                    <button
                      onClick={() => handleImpersonate(company.id)}
                      disabled={impersonating === company.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
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
