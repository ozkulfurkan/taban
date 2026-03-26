'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { CreditCard, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PaymentsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payments')
      .then(r => r.json())
      .then(d => setPayments(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalReceived = payments.filter(p => p.type === 'RECEIVED').reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.filter(p => p.type === 'PAID').reduce((s, p) => s + p.amount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('payments', 'title')}</h1>
          <p className="text-slate-500 text-sm">{payments.length} {t('common', 'actions').toLowerCase()}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('payments', 'totalReceived')}</p>
              <p className="text-lg font-bold text-green-600">{totalReceived.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('payments', 'totalPaid')}</p>
              <p className="text-lg font-bold text-red-500">{totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !payments.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{t('payments', 'empty')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{t('common', 'date')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'type')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'customerSupplier')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'invoice')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'method')}</th>
                  <th className="px-4 py-3 text-right">{t('payments', 'amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 text-slate-500">{new Date(p.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      {p.type === 'RECEIVED' ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <ArrowDownCircle className="w-3.5 h-3.5" /> {t('payments', 'collection')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                          <ArrowUpCircle className="w-3.5 h-3.5" /> {t('payments', 'payment')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.customer?.name ?? p.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.invoice?.invoiceNo ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{p.method}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={p.type === 'RECEIVED' ? 'text-green-600' : 'text-red-500'}>
                        {p.type === 'RECEIVED' ? '+' : '-'}{p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                      </span>
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
