'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { CreditCard, Loader2, ArrowDownCircle, ArrowUpCircle, Info } from '@/app/components/icons';
import Link from 'next/link';
import { Pager } from '@/app/components/pager';
import { motion } from 'framer-motion';

export default function PaymentsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totals, setTotals] = useState<{ type: string; currency: string; amount: number }[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payments?page=${page}&limit=50`)
      .then(r => r.json())
      .then(d => {
        setPayments(Array.isArray(d?.items) ? d.items : []);
        setTotal(d?.total ?? 0);
        setTotalPages(d?.totalPages ?? 1);
        setTotals(Array.isArray(d?.totals) ? d.totals : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  // Toplamlar para birimine göre ayrı gösterilir (TL ile USD toplanmaz)
  const fmtTotals = (type: string) => {
    const list = totals.filter(x => x.type === type && x.amount);
    if (!list.length) return '0,00';
    return list.map(x => `${x.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${x.currency}`).join(' · ');
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">{t('payments', 'title')}</h1>
          <p className="text-ink-500 text-sm">{total.toLocaleString('tr-TR')} {t('common', 'actions').toLowerCase()}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3 border border-ink-200/80">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-ink-500">{t('payments', 'totalReceived')}</p>
              <p className="text-lg font-bold text-emerald-600">{fmtTotals('RECEIVED')}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3 border border-ink-200/80">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-ink-500">{t('payments', 'totalPaid')}</p>
              <p className="text-lg font-bold text-red-500">{fmtTotals('PAID')}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>
        ) : !payments.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-card border border-ink-200/80">
            <CreditCard className="w-12 h-12 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-400 text-sm mb-3">{t('payments', 'empty')}</p>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-brand-800">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>Ödemeler <Link href="/customers" className="font-semibold underline underline-offset-2 hover:text-brand-950">Müşteri</Link> veya <Link href="/suppliers" className="font-semibold underline underline-offset-2 hover:text-brand-950">Tedarikçi</Link> sayfasından eklenir.</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{t('common', 'date')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'type')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'customerSupplier')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'invoice')}</th>
                  <th className="px-4 py-3 text-left">{t('payments', 'method')}</th>
                  <th className="px-4 py-3 text-right">{t('payments', 'amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 20) * 0.02 }}
                    className="hover:bg-ink-50/50"
                  >
                    <td className="px-4 py-3 text-ink-500">{new Date(p.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      {p.type === 'RECEIVED' ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <ArrowDownCircle className="w-3.5 h-3.5" /> {t('payments', 'collection')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                          <ArrowUpCircle className="w-3.5 h-3.5" /> {t('payments', 'payment')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{p.customer?.name ?? p.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{p.invoice?.invoiceNo ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-500">{p.method}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={p.type === 'RECEIVED' ? 'text-emerald-600' : 'text-red-500'}>
                        {p.type === 'RECEIVED' ? '+' : '-'}{p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-ink-400 ml-1">{p.currency}</span>
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pager page={page} totalPages={totalPages} total={total} onChange={p => { setPage(p); window.scrollTo({ top: 0 }); }} />}
      </div>
    </AppShell>
  );
}
