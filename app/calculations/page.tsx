'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Calculator, Trash2, Loader2, Eye, FileText, Pencil, Copy, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function CalculationsPage() {
  const { t, formatCurrency } = useLanguage();
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const router = useRouter();
  const [calcs, setCalcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetch('/api/calculations')
      .then((r) => r.json())
      .then((d) => setCalcs(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    setConfirmModal({ message: 'Bu hesaplamayı silmek istediğinize emin misiniz?', onConfirm: async () => {
      try {
        await fetch(`/api/calculations/${id}`, { method: 'DELETE' });
        setCalcs((prev) => prev.filter((c: any) => c.id !== id));
      } catch (e) { console.error(e); }
    }});
  };

  const handleCopy = (id: string) => {
    router.push(`/calculations/new?copyFrom=${id}`);
  };

  const canEdit = user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER' || user?.role === 'EDITOR';

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('calculation', 'history')}</h1>
            <p className="text-slate-500 text-sm">{t('calculation', 'title')}</p>
          </div>
          <Link href="/calculations/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Calculator className="w-4 h-4" />
            {t('common', 'newCalculation')}
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !calcs.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{t('common', 'noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calcs.map((calc: any, i: number) => (
              <motion.div
                key={calc.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{calc.name ?? '-'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {calc.user?.name ?? ''} • {calc.createdAt ? new Date(calc.createdAt).toLocaleDateString() : ''}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs">
                      <span className="text-slate-500">{t('calculation', 'totalCost')}: <strong className="text-slate-700">{formatCurrency(calc.totalCost ?? 0)}</strong></span>
                      <span className="text-green-600">{t('calculation', 'sellingPrice')}: <strong>{formatCurrency(calc.sellingPrice ?? 0)}</strong></span>
                      {calc.vatRate > 0 && (
                        <span className="text-amber-600">KDV Dahil: <strong>{formatCurrency(calc.sellingPriceWithVat ?? 0)}</strong></span>
                      )}
                      <span className="text-slate-500">{t('calculation', 'profitMargin')}: <strong>{calc.profitMargin ?? 0}%</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <Link href={`/calculations/${calc.id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('common', 'edit')}>
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canEdit && (
                      <>
                        <Link href={`/calculations/${calc.id}/edit`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('calculation', 'editCalculation')}>
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleCopy(calc.id)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title={t('calculation', 'copyCalculation')}>
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(calc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('common', 'delete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Emin misiniz?</h3>
                <p className="text-sm text-slate-600 whitespace-pre-line">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">İptal</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
