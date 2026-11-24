'use client';

import { ShipmentList } from '@/app/components/shipment-list';
import { OrderMessages } from '@/app/components/order-messages';
import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import PortalShell from '../../components/portal-shell';
import OrderStepper from '../../components/order-stepper';
import SizeTable from '../../components/size-table';
import { Loader2, RefreshCw, Truck } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';
import BackLink from '@/app/components/back-link';
import { stageLabel, statusLabel } from '@/lib/order-status';
import { variantLabel, variantText } from '@/lib/shore';

export default function PortalOrderDetailPage() {
  const { tp } = usePortalText();
  const { status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  // İptal / talep
  const [reqOpen, setReqOpen] = useState(false);
  const [reqKind, setReqKind] = useState<'CHANGE_REQUEST' | 'CANCEL_REQUEST'>('CHANGE_REQUEST');
  const [reqText, setReqText] = useState('');
  const [actBusy, setActBusy] = useState(false);
  const [actMsg, setActMsg] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/portal/login'); return; }
    if (status !== 'authenticated' || !params?.id) return;
    fetch(`/api/portal/me/orders/${params.id}`)
      .then(r => r.json()).then(d => setOrder(d.error ? null : d))
      .finally(() => setLoading(false));
  }, [status, router, params?.id, reload]);

  // Onaydan önce doğrudan iptal; sonrasında iptal/değişiklik talebi
  const cancelOrder = async () => {
    if (!confirm(tp('Siparişi iptal etmek istediğinize emin misiniz?'))) return;
    setActBusy(true); setActMsg('');
    const r = await fetch(`/api/portal/me/orders/${params!.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(() => ({}));
    setActBusy(false);
    if (!r.ok) { setActMsg(d.error || tp('Hata oluştu')); return; }
    setReload(x => x + 1);
  };
  const sendRequest = async () => {
    if (!reqText.trim()) return;
    setActBusy(true); setActMsg('');
    const r = await fetch(`/api/portal/me/orders/${params!.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: reqKind, body: reqText.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setActBusy(false);
    if (!r.ok) { setActMsg(d.error || tp('Hata oluştu')); return; }
    setReqOpen(false); setReqText(''); setActMsg(tp('Talebiniz firmaya iletildi.')); setReload(x => x + 1);
  };

  const handleRepeat = () => {
    if (!order) return;
    const p = new URLSearchParams({
      productId: order.productId || '',
      productCode: order.productCode || '',
      color: order.color || '',
      material: order.material || '',
      sizeDistribution: JSON.stringify(order.sizeDistribution || {}),
    });
    router.push(`/portal/orders/new?${p.toString()}`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>;
  if (!order) return <PortalShell><p className="text-ink-500">{tp('Sipariş bulunamadı.')}</p></PortalShell>;

  const isPackage = Array.isArray(order.orderItems) && order.orderItems.length > 0;
  const canCancel = order.status === 'ORDER_RECEIVED' && !order.confirmedAt;
  const canRequest = !canCancel && !order.openRequest && !['SHIPPED', 'CANCELLED'].includes(order.status);
  const price = (pid?: string | null) => (pid && order.prices ? order.prices[pid] : null);
  const money = (n: number, cur: string) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const lineTotal = (pid: string | null | undefined, qty: number) => { const p = price(pid); return p ? money(p.unitPrice * qty, p.currency) : null; };
  const estimate = (() => {
    if (!order.prices) return null;
    const rows = isPackage ? (order.orderItems as any[]).map(i => [i.productId, i.totalQuantity]) : [[order.productId, order.totalQuantity]];
    const byCur: Record<string, number> = {};
    for (const [pid, q] of rows) { const p = price(pid); if (p) byCur[p.currency] = (byCur[p.currency] ?? 0) + p.unitPrice * Number(q || 0); }
    const parts = Object.entries(byCur).map(([c, v]) => money(v, c));
    return parts.length ? parts.join(' + ') : null;
  })();

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BackLink variant="icon" href="/portal/orders" label={tp('Siparişlerim')} />
            <div>
              <h1 className="page-title">{order.orderNo}</h1>
              <p className="text-xs text-ink-400">
                {new Date(order.createdAt).toLocaleDateString('tr-TR')} · {order.source === 'portal' ? tp('Portaldan') : order.source === 'network' ? tp('Firma ağından') : tp('Firma tarafından')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
          {canCancel && (
            <button onClick={cancelOrder} disabled={actBusy} data-testid="portal-cancel"
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium">{tp('Siparişi iptal et')}</button>
          )}
          {order.openRequest && !['SHIPPED', 'CANCELLED'].includes(order.status) && (
            <span className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm font-medium" data-testid="request-pending">
              {tp(order.openRequest === 'CANCEL_REQUEST' ? 'İptal talebi' : 'Değişiklik talebi')} · {tp('yanıt bekliyor')}
            </span>
          )}
          {canRequest && (
            <button onClick={() => setReqOpen(o => !o)} data-testid="portal-request"
              className="px-3 py-2 bg-white border border-ink-200 hover:bg-ink-50 text-ink-700 rounded-lg text-sm font-medium">{tp('İptal / değişiklik talebi')}</button>
          )}
          {!isPackage && (
            <button onClick={handleRepeat}
              className="flex items-center gap-1.5 px-3 py-2 bg-ink-100 hover:bg-ink-200 text-ink-600 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className="w-4 h-4" /> {tp('Tekrarla')}
            </button>
          )}
          </div>
        </div>

        {reqOpen && (
          <div className="bg-white rounded-xl p-4 shadow-card border border-ink-200/80 space-y-3" data-testid="request-form">
            <p className="text-sm text-ink-600">{tp('Sipariş onaylandığı için değişiklik ya da iptal firmanın onayıyla yapılır.')}</p>
            <div className="flex gap-2">
              {(['CHANGE_REQUEST', 'CANCEL_REQUEST'] as const).map(k => (
                <button key={k} onClick={() => setReqKind(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${reqKind === k ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-ink-200'}`}>
                  {k === 'CHANGE_REQUEST' ? tp('Değişiklik talebi') : tp('İptal talebi')}
                </button>
              ))}
            </div>
            <textarea value={reqText} onChange={e => setReqText(e.target.value)} rows={3} maxLength={2000} data-testid="request-text"
              placeholder={reqKind === 'CHANGE_REQUEST' ? tp('Ne değişsin? (ör. 40 numara 20 çift daha)') : tp('İptal nedeni')}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm" />
            <button onClick={sendRequest} disabled={actBusy || !reqText.trim()} data-testid="request-send"
              className="px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium">{tp('Talebi gönder')}</button>
          </div>
        )}
        {actMsg && <p className="text-sm text-ink-700 bg-ink-50 rounded-lg px-3 py-2" role="status">{actMsg}</p>}

        {/* Stepper */}
        <div className="bg-white rounded-xl p-5 shadow-card overflow-x-auto border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-3">{tp('Sipariş Durumu')}</h2>
          <OrderStepper status={order.status} unit={order.unit} />
          {order.status === 'ORDER_RECEIVED' && (
            <p className={`mt-3 text-sm font-medium ${order.confirmedAt ? 'text-emerald-600' : 'text-amber-600'}`} data-testid="order-confirm-state">
              {tp(stageLabel(order))}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-4">{tp('Sipariş Detayları')}</h2>
          {isPackage ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden">
                <thead className="bg-ink-50">
                  <tr>
                    {['Model', tp(variantLabel(order.unit)), tp('Beden Dağılımı'), tp('Adet'), ...(order.prices ? [tp('Tahmini tutar')] : [])].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-500 border-b border-ink-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {(order.orderItems as any[]).map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5 text-xs font-semibold text-ink-700">
                        {item.productCode && <span className="text-brand-700 mr-1">{item.productCode}</span>}
                        {item.productName}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-600">{variantText({ ...item, unit: item.unit ?? order.unit }) || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(item.sizeDistribution || {})
                            .filter(([, qty]) => (qty as number) > 0)
                            .map(([sz, qty]) => (
                              <span key={sz} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-brand-50 text-brand-800 text-xs rounded font-medium">
                                <span className="text-brand-500">{sz}</span>×<span>{qty as number}</span>
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-ink-800">{formatQty(item.totalQuantity, item.unit ?? order.unit)}</td>
                      {order.prices && <td className="px-3 py-2.5 text-xs text-ink-700">{lineTotal(item.productId, item.totalQuantity) ?? '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                [tp('Model Kodu'), order.productCode || order.product?.name || '—'],
                [tp('Renk'), order.color || '—'],
                ...(order.material ? [[tp('Malzeme'), order.material]] : []),
                [tp('Toplam Miktar'), formatQty(order.totalQuantity, order.unit)],
                ...(price(order.productId) ? [[tp('Birim fiyat'), money(price(order.productId).unitPrice, price(order.productId).currency)]] : []),
                [tp('Termin Tarihi'), order.confirmedDeliveryDate
                  ? new Date(order.confirmedDeliveryDate).toLocaleDateString('tr-TR')
                  : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-ink-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-ink-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {estimate && (
            <p className="mt-4 text-sm text-ink-700" data-testid="order-estimate">
              <b>{tp('Tahmini tutar')}:</b> {estimate} <span className="text-xs text-ink-400">({tp('KDV hariç; kesin tutar faturada')})</span>
            </p>
          )}
          {order.notes && <p className="mt-4 text-sm text-ink-600 bg-ink-50 rounded-lg p-3">{order.notes}</p>}
        </div>

        {/* Size table */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-3">{isPackage ? tp('Toplam Beden Dağılımı') : tp('Beden Dağılımı')}</h2>
          <SizeTable value={order.sizeDistribution || {}} readOnly />
        </div>

        {/* Sevkiyatlar (kısmi sevkiyat ve irsaliye) */}
        {order.shipments?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <h2 className="font-semibold text-ink-700 mb-3">{tp('Sevkiyat Bilgileri')}</h2>
            <ShipmentList shipments={order.shipments} noteEndpoint={`/api/portal/me/orders/${order.id}/delivery-note`} t={tp} complete={order.status === 'SHIPPED'} />
          </div>
        )}

        <OrderMessages endpoint={`/api/portal/me/orders/${order.id}/messages`} viewer="customer" t={tp} refreshKey={reload} />

        {/* Status history */}
        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <h2 className="font-semibold text-ink-700 mb-3">{tp('Durum Geçmişi')}</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-ink-700">{tp(statusLabel(h.status, order.unit))}</span>
                    {h.note && <span className="text-ink-500 ml-2">— {h.note}</span>}
                    <p className="text-xs text-ink-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
