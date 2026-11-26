'use client';

// Sevk fişi detayı: yeniden yazdır, hesaba işlenmediyse (eksik fiyatları girip) cari hesaba işle
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import { CheckCircle, Loader2, Printer, Truck, AlertTriangle } from '@/app/components/icons';
import { printDispatch } from '@/app/components/dispatch-print';
import { formatQty } from '@/lib/order-units';

const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Detail() {
  const params = useParams();
  const sp = useSearchParams();
  const id = String(params?.id ?? '');
  const [d, setD] = useState<any>(null);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(sp.get('uyari') ? { ok: false, text: `Fiş kaydedildi ama hesaba işlenemedi: ${sp.get('uyari')}` } : sp.get('yeni') ? { ok: true, text: 'Sevk fişi kaydedildi.' } : null);
  const load = useCallback(() => { fetch(`/api/dispatches/${id}`).then(r => r.json()).then(setD).catch(() => setD({ error: true })); }, [id]);
  useEffect(() => { load(); }, [load]);

  const post = async () => {
    setBusy(true); setMsg(null);
    const body = { prices: Object.fromEntries(Object.entries(prices).filter(([, v]) => v.trim()).map(([k, v]) => [k, Number(v.replace(',', '.'))])) };
    const r = await fetch(`/api/dispatches/${id}/post`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Cari hesaba işlendi: ${j.invoice?.invoiceNo}` } : { ok: false, text: j.error || 'Hesaba işlenemedi' });
    load();
  };

  if (!d) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-700" /></div>;
  if (d.error) return <p className="text-ink-500">Sevk fişi bulunamadı.</p>;
  const orders = Array.from(new Map((d.shipments ?? []).map((s: any) => [s.orderId, s.order?.orderNo])).entries()) as Array<[string, string]>;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="space-y-1">
        <BackLink href="/sevkiyat" label="Sevkiyat" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title flex items-center gap-2"><Truck className="w-6 h-6 text-brand-700" /> {d.no}</h1>
          <button type="button" onClick={() => void printDispatch(id)} data-testid="sv-print" className="inline-flex items-center gap-2 px-4 py-2 border border-ink-200 bg-white hover:bg-ink-50 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Yazdır
          </button>
        </div>
      </div>
      {msg && <div role="status" className={`rounded-lg px-3 py-2.5 text-sm flex items-start gap-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
        {msg.ok ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{msg.text}</div>}

      <section className="bg-white rounded-xl border border-ink-200/80 shadow-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><p className="text-xs text-ink-400">Müşteri</p><p className="font-semibold">{d.customer?.name}</p></div>
        <div><p className="text-xs text-ink-400">Tarih</p><p>{new Date(d.date).toLocaleDateString('tr-TR')}</p></div>
        <div><p className="text-xs text-ink-400">Taşıyıcı / plaka / şoför</p><p>{[d.carrier, d.vehiclePlate, d.driverName].filter(Boolean).join(' · ') || '—'}</p></div>
        <div><p className="text-xs text-ink-400">Durum</p>
          {d.invoice ? <Link href={`/invoices/${d.invoice.id}`} className="font-semibold text-emerald-700 hover:underline" data-testid="sv-invoice">Hesaba işlendi · {d.invoice.invoiceNo}</Link>
            : <p className="font-semibold text-amber-700" data-testid="sv-draft">Hesaba işlenmedi</p>}</div>
        {orders.length > 0 && <div className="col-span-2 md:col-span-4"><p className="text-xs text-ink-400">Siparişler</p>
          <p>{orders.map(([oid, no]) => <Link key={oid} href={`/orders/${oid}`} className="mr-3 text-brand-700 hover:underline">{no}</Link>)}</p></div>}
        {d.notes && <div className="col-span-2 md:col-span-4"><p className="text-xs text-ink-400">Not</p><p>{d.notes}</p></div>}
      </section>

      <section className="bg-white rounded-xl border border-ink-200/80 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-xs text-ink-500"><tr><th className="px-4 py-2 text-left">Ürün</th><th className="px-4 py-2 text-right">Miktar</th>
            {d.canPrice && <><th className="px-4 py-2 text-right">Birim fiyat</th><th className="px-4 py-2 text-right">Tutar</th></>}</tr></thead>
          <tbody className="divide-y divide-ink-100">
            {d.lines.map((l: any, i: number) => (
              <tr key={i}>
                <td className="px-4 py-2"><b className="text-brand-700 mr-1">{l.code}</b>{l.name}{l.invoiced && <span className="block text-[11px] text-ink-400">Sipariş daha önce satışa çevrildi</span>}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatQty(l.qty, l.unit)}</td>
                {d.canPrice && <>
                  <td className="px-4 py-2 text-right">{l.unitPrice != null ? money(l.unitPrice)
                    : !d.invoice ? <input value={prices[i] ?? ''} onChange={e => setPrices(p => ({ ...p, [i]: e.target.value }))} inputMode="decimal" placeholder="Fiyat girin" data-testid="sv-missing-price"
                      className="w-28 px-2 py-1 border border-red-400 bg-red-50 rounded text-right" /> : '—'}</td>
                  <td className="px-4 py-2 text-right">{l.unitPrice != null ? money(l.unitPrice * l.qty) : '—'}</td>
                </>}
              </tr>
            ))}
          </tbody>
          {d.canPrice && d.total != null && <tfoot><tr className="font-semibold"><td className="px-4 py-2" colSpan={3}>Genel toplam (KDV %{d.vatRate} dahil)</td><td className="px-4 py-2 text-right">{money(d.total)} {d.currency}</td></tr></tfoot>}
        </table>
      </section>

      {!d.invoice && d.status !== 'CANCELLED' && (d.canPrice ? (
        <button type="button" data-submit onClick={() => void post()} disabled={busy} data-testid="sv-post-now"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Cari hesaba işle
        </button>
      ) : <p className="text-sm text-ink-500">Bu fiş hesaba işlenmedi. Fiyat yetkisi olan bir yönetici fişi açıp &quot;Cari hesaba işle&quot; diyebilir.</p>)}
    </div>
  );
}

export default function Page() {
  return <AppShell><Suspense fallback={null}><Detail /></Suspense></AppShell>;
}
