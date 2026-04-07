'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import OrderStepper from '@/app/portal/components/order-stepper';
import SizeTable from '@/app/portal/components/size-table';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save, Truck, ShoppingCart, Printer, X } from 'lucide-react';

const ALL_STATUSES = [
  { key: 'ORDER_RECEIVED', label: 'Sipariş Alındı' },
  { key: 'IN_PRODUCTION', label: 'Üretime Girdi' },
  { key: 'MOLDING', label: 'Kalıplama' },
  { key: 'PAINTING', label: 'Boya / Apre' },
  { key: 'PACKAGING', label: 'Paketleme' },
  { key: 'READY_FOR_SHIPMENT', label: 'Sevkiyata Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
];

export default function PortalAdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusForm, setStatusForm] = useState({ status: '', note: '', confirmedDeliveryDate: '' });
  const [shipForm, setShipForm] = useState({ shipmentDate: '', deliveryNoteNo: '', carrier: '', trackingNo: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const loadOrder = () => {
    if (!params?.id) return;
    fetch(`/api/portal/orders/${params.id}`)
      .then(r => r.json()).then(d => {
        setOrder(d);
        setStatusForm(f => ({
          ...f,
          status: d.status,
          confirmedDeliveryDate: d.confirmedDeliveryDate
            ? new Date(d.confirmedDeliveryDate).toISOString().split('T')[0]
            : '',
        }));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrder(); }, [params?.id]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.status) return;
    setSaving(true);
    await fetch(`/api/portal/orders/${params?.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusForm),
    });
    setSaving(false);
    loadOrder();
  };

  const handleShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setShipping(true);
    await fetch(`/api/portal/orders/${params?.id}/shipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipForm),
    });
    setShipping(false);
    setShowShipForm(false);
    loadOrder();
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div></AppShell>;
  if (!order || order.error) return <AppShell><p className="text-slate-500">Sipariş bulunamadı.</p></AppShell>;

  return (
    <>
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800">{order.orderNo}</h1>
            <p className="text-xs text-slate-400">{order.customer?.name} · {new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" /> Üretim Çıktısı
            </button>
            <Link
              href={`/invoices/new?customerId=${order.customerId}${order.productId ? `&productId=${order.productId}` : ''}&quantity=${order.totalQuantity}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Satışa Çevir
            </Link>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl p-5 shadow-sm overflow-x-auto">
          <OrderStepper status={order.status} />
        </div>

        {/* Status update */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Durum Güncelle</h2>
          <form onSubmit={handleStatusUpdate} className="space-y-3">
            <select value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              {ALL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Termin Tarihi</label>
              <input type="date" value={statusForm.confirmedDeliveryDate}
                onChange={e => setStatusForm(f => ({ ...f, confirmedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <input placeholder="Not (opsiyonel)" value={statusForm.note} onChange={e => setStatusForm(f => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Kaydet & Bildirim Gönder
            </button>
          </form>
        </div>

        {/* Shipment */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">Sevkiyat</h2>
            {!showShipForm && (
              <button onClick={() => setShowShipForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors">
                <Truck className="w-4 h-4" /> {order.shipment ? 'Güncelle' : 'Sevkiyat Ekle'}
              </button>
            )}
          </div>
          {order.shipment && !showShipForm && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[['Sevk Tarihi', new Date(order.shipment.shipmentDate).toLocaleDateString('tr-TR')],
                ['İrsaliye No', order.shipment.deliveryNoteNo || '—'],
                ['Taşıyıcı', order.shipment.carrier || '—'],
                ['Takip No', order.shipment.trackingNo || '—']].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {showShipForm && (
            <form onSubmit={handleShipment} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Sevk Tarihi *</label>
                <input type="date" required value={shipForm.shipmentDate} onChange={e => setShipForm(f => ({ ...f, shipmentDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              {[['deliveryNoteNo', 'İrsaliye No'], ['carrier', 'Taşıyıcı'], ['trackingNo', 'Takip No']].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                  <input value={(shipForm as any)[field]} onChange={e => setShipForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Not</label>
                <input value={shipForm.notes} onChange={e => setShipForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="button" onClick={() => setShowShipForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
                <button type="submit" disabled={shipping}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                  {shipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  Sevkiyatı Kaydet & Bildir
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Order details */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Sipariş Detayları</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
            {[['Model', order.productCode || order.product?.name || '—'],
              ['Renk', order.color || '—'],
              ['Malzeme', order.material || '—'],
              ['Toplam Adet', order.totalQuantity],
              ['Portal Kullanıcı', order.portalCustomer?.email || '—'],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className="font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
          <SizeTable value={order.sizeDistribution || {}} readOnly />
        </div>

        {/* Status history */}
        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-3">Durum Geçmişi</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700">{h.status.replace(/_/g, ' ')}</span>
                    {h.note && <span className="text-slate-500 ml-2">— {h.note}</span>}
                    <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>

    {/* Print Modal */}
    {showPrintModal && (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden" onClick={() => setShowPrintModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:hidden">
            <h3 className="font-semibold text-slate-800">Üretim Çıktısı</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const style = document.createElement('style');
                  style.innerHTML = '@media print { body > * { display: none !important; } #print-content-wrapper { display: block !important; position: fixed; inset: 0; background: white; padding: 32px; overflow: visible; } }';
                  document.head.appendChild(style);
                  window.print();
                  setTimeout(() => document.head.removeChild(style), 1000);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> Yazdır
              </button>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div id="print-content-wrapper" className="p-8 space-y-6 text-sm">
            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Üretim Emri</p>
                <h2 className="text-2xl font-bold text-slate-800">{order.orderNo}</h2>
              </div>
              <div className="text-right text-xs text-slate-500 space-y-0.5">
                <p>Tarih: {new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
                {(order.confirmedDeliveryDate || order.requestedDeliveryDate) && (
                  <p>Termin: <span className="font-semibold text-slate-700">{new Date(order.confirmedDeliveryDate ?? order.requestedDeliveryDate).toLocaleDateString('tr-TR')}</span></p>
                )}
              </div>
            </div>

            {/* Customer & Product */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Müşteri</p>
                <p className="font-semibold text-slate-800">{order.customer?.name}</p>
                {order.portalCustomer?.email && <p className="text-xs text-slate-500">{order.portalCustomer.email}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ürün</p>
                <p className="font-semibold text-slate-800">{order.productCode || order.product?.code || '—'}</p>
                {order.product?.name && order.product.name !== order.productCode && (
                  <p className="text-xs text-slate-500">{order.product.name}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Renk</p>
                <p className="font-semibold text-slate-800">{order.color || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Malzeme</p>
                <p className="font-semibold text-slate-800">{order.material || '—'}</p>
              </div>
            </div>

            {/* Size distribution */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Beden Dağılımı</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-center text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(order.sizeDistribution || {}).filter(sz => (order.sizeDistribution[sz] || 0) > 0).map(sz => (
                        <th key={sz} className="px-3 py-2 font-semibold text-slate-600 border-r border-slate-200 last:border-0">{sz}</th>
                      ))}
                      <th className="px-3 py-2 font-bold text-blue-700 bg-blue-50">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {Object.keys(order.sizeDistribution || {}).filter(sz => (order.sizeDistribution[sz] || 0) > 0).map(sz => (
                        <td key={sz} className="px-3 py-2.5 font-medium text-slate-800 border-r border-slate-200 last:border-0">{order.sizeDistribution[sz]}</td>
                      ))}
                      <td className="px-3 py-2.5 font-bold text-blue-700 bg-blue-50">{order.totalQuantity}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notlar</p>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{order.notes}</p>
              </div>
            )}

            {/* Signature line */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200">
              {['Hazırlayan', 'Kontrol Eden', 'Onaylayan'].map(label => (
                <div key={label} className="text-center">
                  <div className="border-b border-slate-400 h-10 mb-2" />
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
