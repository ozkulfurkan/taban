'use client';

// Siparişler → Sevkiyat: sevke hazır siparişler (müşteriye göre) ve kesilen sevk fişleri
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import { Loader2, Plus, Truck, Printer } from '@/app/components/icons';
import { printDispatch } from '@/app/components/dispatch-print';
import { formatQty } from '@/lib/order-units';

const STATUS: Record<string, [string, string]> = {
  POSTED: ['Hesaba işlendi', 'bg-emerald-100 text-emerald-700'],
  DRAFT: ['Hesaba işlenmedi', 'bg-amber-100 text-amber-800'],
  POSTING: ['İşleniyor', 'bg-ink-100 text-ink-600'],
  CANCELLED: ['İptal', 'bg-ink-100 text-ink-500'],
};

export default function DispatchListPage() {
  const [ready, setReady] = useState<any[] | null>(null);
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => {
    fetch('/api/dispatches/ready').then(r => r.json()).then(d => setReady(Array.isArray(d) ? d : [])).catch(() => setReady([]));
    fetch('/api/dispatches').then(r => r.json()).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  }, []);
  const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title flex items-center gap-2"><Truck className="w-6 h-6 text-brand-700" /> Sevkiyat</h1>
          <Link href="/sevkiyat/yeni" data-testid="sv-new" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Yeni Sevk Fişi
          </Link>
        </div>

        <section className="bg-white rounded-xl border border-ink-200/80 shadow-card">
          <h2 className="px-4 py-3 border-b border-ink-100 font-semibold text-ink-700">Sevke hazır siparişler</h2>
          {ready === null ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-700" /></div>
            : ready.length === 0 ? <p className="px-4 py-6 text-sm text-ink-400">&quot;Sevkiyata Hazır&quot; durumunda sipariş yok. Yeni Sevk Fişi ile müşteri seçip açık siparişlerden ya da siparişsiz sevk edebilirsiniz.</p>
            : (
              <ul className="divide-y divide-ink-100" data-testid="sv-ready">
                {ready.map(g => (
                  <li key={g.customer.id} className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                    <div><p className="font-semibold text-ink-800">{g.customer.name}</p>
                      <p className="text-xs text-ink-500">{g.orders.map((o: any) => `${o.orderNo} (${formatQty(o.totalQuantity, o.unit)})`).join(' · ')}</p></div>
                    <Link href={`/sevkiyat/yeni?customerId=${g.customer.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                      <Truck className="w-4 h-4" /> Sevk et
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="bg-white rounded-xl border border-ink-200/80 shadow-card overflow-hidden">
          <h2 className="px-4 py-3 border-b border-ink-100 font-semibold text-ink-700">Sevk fişleri</h2>
          {list === null ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-700" /></div>
            : list.length === 0 ? <p className="px-4 py-6 text-sm text-ink-400">Henüz sevk fişi yok.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="sv-list">
                  <thead className="bg-ink-50 text-xs text-ink-500"><tr>
                    <th className="px-4 py-2 text-left">Fiş no</th><th className="px-4 py-2 text-left">Tarih</th><th className="px-4 py-2 text-left">Müşteri</th>
                    <th className="px-4 py-2 text-left">Taşıyıcı / plaka</th><th className="px-4 py-2 text-right">Tutar</th><th className="px-4 py-2 text-left">Durum</th><th className="px-4 py-2"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {list.map(d => {
                      const [label, cls] = STATUS[d.status] ?? [d.status, 'bg-ink-100'];
                      return (
                        <tr key={d.id} className="hover:bg-ink-50">
                          <td className="px-4 py-2"><Link href={`/sevkiyat/${d.id}`} className="font-semibold text-brand-700 hover:underline">{d.no}</Link></td>
                          <td className="px-4 py-2 whitespace-nowrap">{new Date(d.date).toLocaleDateString('tr-TR')}</td>
                          <td className="px-4 py-2">{d.customer?.name}</td>
                          <td className="px-4 py-2 text-ink-500">{[d.carrier, d.vehiclePlate].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">{d.total != null ? `${money(d.total)} ${d.currency}` : '—'}</td>
                          <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                            {d.status === 'DRAFT' && d.missingPrice && <span className="block text-[11px] text-red-600">Fiyat bekliyor</span>}</td>
                          <td className="px-4 py-2 text-right"><button type="button" onClick={() => void printDispatch(d.id)} className="p-1.5 text-ink-500 hover:text-ink-800" aria-label={`${d.no} yazdır`}><Printer className="w-4 h-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>
    </AppShell>
  );
}
