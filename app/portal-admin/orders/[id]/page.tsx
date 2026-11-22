'use client';

import { shipLines } from '@/lib/shipment';
import { ShipQtyInputs, ShippedTable } from '@/app/components/shipment-qty';
import { formatQty } from '@/lib/order-units';
import { orderSteps, statusLabel } from '@/lib/order-status';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import OrderStepper from '@/app/portal/components/order-stepper';
import SizeTable from '@/app/portal/components/size-table';
import Link from 'next/link';
import { Loader2, Save, Truck, ShoppingCart, Printer, X, Factory } from '@/app/components/icons';
import BackLink from '@/app/components/back-link';


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
  const [showSubModal, setShowSubModal] = useState(false);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [subModalItem, setSubModalItem] = useState<any>(null);

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

  useEffect(() => {
    fetch('/api/subcontractors').then(r => r.json()).then(d => { if (Array.isArray(d)) setSubcontractors(d); });
  }, []);

  const handleSendToSubcontractor = () => {
    if (!selectedSubId) return;
    const source = subModalItem ?? order;
    const sizeDistribution = JSON.stringify(source.sizeDistribution ?? order.sizeDistribution ?? {});
    const params2 = new URLSearchParams({
      subcontractorId: selectedSubId,
      step: '1',
      sizeDistribution,
      soleOrderId: order.id,
    });
    const productId = subModalItem?.productId ?? order.productId;
    if (productId) params2.set('productId', productId);
    router.push(`/subcontractor-orders/new?${params2.toString()}`);
  };

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

  const [shipQty, setShipQty] = useState<Record<number, string>>({});
  const handleShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setShipping(true);
    await fetch(`/api/portal/orders/${params?.id}/shipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...shipForm, items: shipLines(order).map(l => ({ index: l.index, shipped: shipQty[l.index] ? Number(shipQty[l.index]) : undefined })) }),
    });
    setShipping(false);
    setShowShipForm(false);
    loadOrder();
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-700" /></div></AppShell>;
  if (!order || order.error) return <AppShell><p className="text-ink-500">Sipariş bulunamadı.</p></AppShell>;

  const isPackage = Array.isArray(order.orderItems) && order.orderItems.length > 0;

  return (
    <>
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <BackLink variant="icon" href="/portal-admin" label="Portal Siparişleri" />
          <div className="flex-1 min-w-0">
            <h1 className="page-title">{order.orderNo}</h1>
            <p className="text-xs text-ink-400">{order.customer?.name} · {new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" /> Üretim Çıktısı
            </button>
            {!isPackage && (
              Array.isArray(order.subcontractorOrders) && order.subcontractorOrders.length > 0
                ? order.subcontractorOrders.map((so: any) => (
                    <Link key={so.id} href={`/subcontractors/${so.subcontractor.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium transition-colors hover:bg-amber-200">
                      <Factory className="w-4 h-4" /> {so.subcontractor.name}
                    </Link>
                  ))
                : (
                    <button
                      onClick={() => { setSubModalItem(null); setShowSubModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Factory className="w-4 h-4" /> Fasoncuya Gönder
                    </button>
                  )
            )}
            <Link
              href={`/invoices/new?customerId=${order.customerId}${order.productId ? `&productId=${order.productId}` : ''}&quantity=${order.totalQuantity}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Satışa Çevir
            </Link>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl p-5 shadow-card overflow-x-auto border border-ink-200/80">
          <OrderStepper status={order.status} unit={order.unit} />
        </div>

        {/* Status update */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-4">Durum Güncelle</h2>
          <form onSubmit={handleStatusUpdate} className="space-y-3">
            <select value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none">
              {orderSteps(order.unit).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Termin Tarihi</label>
              <input type="date" value={statusForm.confirmedDeliveryDate}
                onChange={e => setStatusForm(f => ({ ...f, confirmedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            </div>
            <input placeholder="Not (opsiyonel)" value={statusForm.note} onChange={e => setStatusForm(f => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Kaydet & Bildirim Gönder
            </button>
          </form>
        </div>

        {/* Shipment */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-700">Sevkiyat</h2>
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
                  <dt className="text-xs text-ink-400">{k}</dt>
                  <dd className="font-medium text-ink-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {order.shipment && !showShipForm && Array.isArray(order.shipment.items) && (
            <div className="mt-4 pt-3 border-t border-ink-100"><ShippedTable items={order.shipment.items} /></div>
          )}
          {showShipForm && (
            <form onSubmit={handleShipment} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink-500 mb-1">Sevk Tarihi *</label>
                <input type="date" required value={shipForm.shipmentDate} onChange={e => setShipForm(f => ({ ...f, shipmentDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
              </div>
              {[['deliveryNoteNo', 'İrsaliye No'], ['carrier', 'Taşıyıcı'], ['trackingNo', 'Takip No']].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>
                  <input value={(shipForm as any)[field]} onChange={e => setShipForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                </div>
              ))}
              <div className="col-span-2"><ShipQtyInputs lines={shipLines(order)} value={shipQty} onChange={setShipQty} /></div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink-500 mb-1">Not</label>
                <input value={shipForm.notes} onChange={e => setShipForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="button" onClick={() => setShowShipForm(false)}
                  className="px-4 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">İptal</button>
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
        <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
          <h2 className="font-semibold text-ink-700 mb-4">Sipariş Detayları</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
            {[['Model', order.productCode || order.product?.name || '—'],
              ['Malzeme', order.material || '—'],
              ['Toplam Miktar', formatQty(order.totalQuantity, order.unit)],
              ['Portal Kullanıcı', order.portalCustomer?.email || '—'],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-xs text-ink-400">{k}</dt>
                <dd className="font-medium text-ink-700">{v}</dd>
              </div>
            ))}
          </dl>
          {/* Paket İçeriği */}
          {isPackage && (
            <div className="mb-4 overflow-x-auto">
              <p className="text-xs text-ink-400 mb-2 uppercase tracking-wide font-semibold">Paket İçeriği</p>
              <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden">
                <thead className="bg-ink-50">
                  <tr>
                    {['Model', 'Renk', 'Beden Dağılımı', 'Adet', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-500 border-b border-ink-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {(order.orderItems as any[]).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-ink-50">
                      <td className="px-3 py-2.5">
                        {item.productCode && <span className="text-xs font-semibold text-brand-700 mr-1">{item.productCode}</span>}
                        {item.productName && <span className="text-ink-700 text-xs">{item.productName}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-600 text-xs">{item.color || '—'}</td>
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
                      <td className="px-3 py-2.5 font-semibold text-ink-800 whitespace-nowrap text-xs">{formatQty(item.totalQuantity, item.unit ?? order.unit)}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => { setSubModalItem(item); setShowSubModal(true); }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium whitespace-nowrap"
                        >
                          <Factory className="w-3.5 h-3.5" /> Fasoncuya
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Renk Partileri */}
          {!isPackage && Array.isArray(order.colorPartials) && order.colorPartials.length > 0 ? (
            <div className="mb-4">
              <p className="text-xs text-ink-400 mb-2">Renk Partileri</p>
              <div className="flex flex-wrap gap-2">
                {(order.colorPartials as any[]).map((p: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 text-brand-800 rounded-full text-xs font-medium">
                    <span className="text-brand-500">{p.name}</span>
                    <span className="w-px h-3 bg-brand-200" />
                    {p.color}
                  </span>
                ))}
              </div>
            </div>
          ) : order.color ? (
            <div className="mb-4">
              <p className="text-xs text-ink-400 mb-1">Renk</p>
              <p className="font-medium text-ink-700">{order.color}</p>
            </div>
          ) : null}
          <SizeTable value={order.sizeDistribution || {}} readOnly />
        </div>

        {/* Status history */}
        {order.statusHistory?.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
            <h2 className="font-semibold text-ink-700 mb-3">Durum Geçmişi</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-ink-700">{statusLabel(h.status, order.unit)}</span>
                    {h.note && <span className="text-ink-500 ml-2">— {h.note}</span>}
                    <p className="text-xs text-ink-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>

    {/* Fasoncuya Gönder Modal */}
    {showSubModal && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSubModal(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink-800 flex items-center gap-2">
              <Factory className="w-5 h-5 text-amber-500" />
              {subModalItem
                ? `${subModalItem.productCode || subModalItem.productName || 'Ürün'} / ${subModalItem.color || '—'} — Fasoncuya Gönder`
                : 'Fasoncuya Gönder'}
            </h3>
            <button onClick={() => setShowSubModal(false)} className="p-1 text-ink-400 hover:text-ink-600 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-ink-500">
            Fason siparişi oluşturmak için bir fasoncu seçin. Numara dağılımı otomatik aktarılacak.
          </p>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Fasoncu *</label>
            <select value={selectedSubId} onChange={e => setSelectedSubId(e.target.value)}
              className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white">
              <option value="">— Fasoncu Seçin —</option>
              {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowSubModal(false)}
              className="flex-1 px-4 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">
              İptal
            </button>
            <button onClick={handleSendToSubcontractor} disabled={!selectedSubId}
              className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              <Factory className="w-4 h-4" /> Devam Et
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Print Modal */}
    {showPrintModal && (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden" onClick={() => setShowPrintModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-ink-200/80" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 print:hidden">
            <h3 className="font-semibold text-ink-800">Üretim Çıktısı</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const source = document.getElementById('print-content-wrapper');
                  if (!source) return;
                  const portal = document.createElement('div');
                  portal.id = '__print_portal__';
                  portal.style.cssText = 'position:fixed;inset:0;background:white;z-index:99999;padding:32px;font-family:sans-serif;font-size:14px;';
                  portal.innerHTML = source.innerHTML;
                  document.body.appendChild(portal);
                  const style = document.createElement('style');
                  style.id = '__print_style__';
                  style.innerHTML = '@media print { body > *:not(#__print_portal__) { display: none !important; } }';
                  document.head.appendChild(style);
                  window.print();
                  setTimeout(() => {
                    portal.remove();
                    style.remove();
                  }, 1000);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> Yazdır
              </button>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div id="print-content-wrapper" className="p-8 space-y-6 text-sm">
            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-ink-800 pb-4">
              <div>
                <p className="text-xs text-ink-500 uppercase tracking-widest font-semibold mb-1">Üretim Emri</p>
                <h2 className="text-2xl font-bold text-ink-800">{order.orderNo}</h2>
              </div>
              <div className="text-right text-xs text-ink-500 space-y-0.5">
                <p>Tarih: {new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
                {(order.confirmedDeliveryDate || order.requestedDeliveryDate) && (
                  <p>Termin: <span className="font-semibold text-ink-700">{new Date(order.confirmedDeliveryDate ?? order.requestedDeliveryDate).toLocaleDateString('tr-TR')}</span></p>
                )}
              </div>
            </div>

            {/* Customer & Product */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Müşteri</p>
                <p className="font-semibold text-ink-800">{order.customer?.name}</p>
                {order.portalCustomer?.email && <p className="text-xs text-ink-500">{order.portalCustomer.email}</p>}
              </div>
              {!isPackage && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Ürün</p>
                    <p className="font-semibold text-ink-800">{order.productCode || order.product?.code || '—'}</p>
                    {order.product?.name && order.product.name !== order.productCode && (
                      <p className="text-xs text-ink-500">{order.product.name}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Renk</p>
                    <p className="font-semibold text-ink-800">{order.color || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Malzeme</p>
                    <p className="font-semibold text-ink-800">{order.material || '—'}</p>
                  </div>
                </>
              )}
            </div>

            {/* Package items table (print) */}
            {isPackage && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Paket İçeriği</p>
                <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden">
                  <thead className="bg-ink-50">
                    <tr>
                      {['Model', 'Renk', 'Beden Dağılımı', 'Adet'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-500 border-b border-ink-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {(order.orderItems as any[]).map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs font-semibold text-ink-700">{item.productCode || item.productName || '—'}</td>
                        <td className="px-3 py-2 text-xs text-ink-600">{item.color || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(item.sizeDistribution || {})
                              .filter(([, qty]) => (qty as number) > 0)
                              .map(([sz, qty]) => (
                                <span key={sz} className="text-xs text-ink-700">{sz}×{qty as number}</span>
                              ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-ink-800">{formatQty(item.totalQuantity, item.unit ?? order.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Size distribution (aggregate) */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{isPackage ? 'Toplam Beden Dağılımı' : 'Beden Dağılımı'}</p>
              <div className="border border-ink-200 rounded-lg overflow-hidden">
                <table className="w-full text-center text-sm">
                  <thead className="bg-ink-50">
                    <tr>
                      {Object.keys(order.sizeDistribution || {}).filter(sz => (order.sizeDistribution[sz] || 0) > 0).map(sz => (
                        <th key={sz} className="px-3 py-2 font-semibold text-ink-600 border-r border-ink-200 last:border-0">{sz}</th>
                      ))}
                      <th className="px-3 py-2 font-bold text-brand-800 bg-brand-50">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {Object.keys(order.sizeDistribution || {}).filter(sz => (order.sizeDistribution[sz] || 0) > 0).map(sz => (
                        <td key={sz} className="px-3 py-2.5 font-medium text-ink-800 border-r border-ink-200 last:border-0">{order.sizeDistribution[sz]}</td>
                      ))}
                      <td className="px-3 py-2.5 font-bold text-brand-800 bg-brand-50">{formatQty(order.totalQuantity, order.unit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Notlar</p>
                <p className="text-ink-700 bg-ink-50 rounded-lg p-3">{order.notes}</p>
              </div>
            )}

            {/* Signature line */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-ink-200">
              {['Hazırlayan', 'Kontrol Eden', 'Onaylayan'].map(label => (
                <div key={label} className="text-center">
                  <div className="border-b border-ink-400 h-10 mb-2" />
                  <p className="text-xs text-ink-500">{label}</p>
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
