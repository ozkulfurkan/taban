'use client';

import { formatQty, isPairUnit } from '@/lib/order-units';
import { nextStatuses, statusLabel } from '@/lib/order-status';
import { remainingLines, shipLines, shippedSoFar } from '@/lib/shipment';
import { ShipmentList } from '@/app/components/shipment-list';
import { OrderMessages } from '@/app/components/order-messages';
import { ShipQtyInputs } from '@/app/components/shipment-qty';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import OrderStepper from '@/app/portal/components/order-stepper';
import SizeTable from '@/app/portal/components/size-table';
import Link from 'next/link';
import BackLink from '@/app/components/back-link';
import { Loader2, Save, Truck, ShoppingCart, Printer, X, Factory, CheckCircle, AlertTriangle, Package, Check } from '@/app/components/icons';
import { variantLabel, variantText } from '@/lib/shore';
import { useSession } from 'next-auth/react';
import { KoliLabelModal, type KoliSource } from '@/app/components/koli-label-modal';


const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR') : '—';

function calcMaterialReqs(order: any, materialsList: any[]): Array<{ materialId: string; name: string; requiredKg: number; currentStock: number }> {
  const map = new Map<string, { materialId: string; name: string; requiredKg: number; currentStock: number }>();
  const pvData: Array<{ partId: string; materialId: string }> =
    Array.isArray(order.partVariantsData) ? order.partVariantsData : [];

  // Paket siparişte her kalem kendi ürün reçetesi ve miktarıyla hesaplanır
  const jobs: Array<{ product: any; qty: number }> = Array.isArray(order.orderItems) && order.orderItems.length
    ? (order.orderItems as any[]).map(i => ({ product: (order.itemProducts ?? []).find((p: any) => p.id === i.productId), qty: Number(i.totalQuantity) || 0 }))
    : [{ product: order.product, qty: order.totalQuantity }];

  for (const { product, qty } of jobs) for (const part of product?.parts ?? []) {
    const matId = pvData.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
    if (!matId) continue;
    const mat = materialsList.find((m: any) => m.id === matId) ?? part.material;
    if (!mat) continue;
    const kgNeeded = (part.gramsPerPiece * (1 + part.wasteRate / 100) * qty) / 1000;
    const existing = map.get(matId);
    if (existing) {
      existing.requiredKg += kgNeeded;
    } else {
      map.set(matId, {
        materialId: matId,
        name: mat.name,
        requiredKg: kgNeeded,
        currentStock: mat.stock ?? 0,
      });
    }
  }

  return Array.from(map.values()).map(m => ({ ...m, requiredKg: Math.round(m.requiredKg * 1000) / 1000 }));
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusForm, setStatusForm] = useState({ status: '', note: '', confirmedDeliveryDate: '' });
  const [shipForm, setShipForm] = useState({ shipmentDate: '', deliveryNoteNo: '', carrier: '', trackingNo: '', notes: '' });
  const [actionError, setActionError] = useState('');
  const [shipQty, setShipQty] = useState<Record<number, string>>({});
  // Kısmi sevkiyat: null = yeni sevkiyat, id = mevcut sevkiyatı düzenle
  const [shipTarget, setShipTarget] = useState<string | null>(null);
  const [shipFinal, setShipFinal] = useState(true);
  const [msgKey, setMsgKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [shipping, setShipping] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showKoli, setShowKoli] = useState(false);
  const { data: session } = useSession() || {};
  const isMaterial = (session?.user as any)?.companyType === 'MATERIAL_SUPPLIER';
  const [showSubModal, setShowSubModal] = useState(false);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [subModalItem, setSubModalItem] = useState<any>(null);

  const loadOrder = () => {
    if (!params?.id) return;
    fetch(`/api/orders/${params.id}`)
      .then(r => r.json())
      .then(d => {
        setOrder(d);
        setStatusForm(f => ({
          ...f,
          status: d.status,
          confirmedDeliveryDate: d.confirmedDeliveryDate
            ? new Date(d.confirmedDeliveryDate).toISOString().split('T')[0]
            : d.requestedDeliveryDate
              ? new Date(d.requestedDeliveryDate).toISOString().split('T')[0]
              : '',
        }));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrder(); }, [params?.id]);

  useEffect(() => {
    fetch('/api/subcontractors').then(r => r.json()).then(d => { if (Array.isArray(d)) setSubcontractors(d); });
    fetch('/api/materials').then(r => r.json()).then(d => { if (Array.isArray(d)) setMaterialsList(d); });
  }, []);

  const handleSendToSubcontractor = () => {
    if (!selectedSubId) return;
    const source = subModalItem ?? order;
    const sizeDistribution = JSON.stringify(source.sizeDistribution ?? order.sizeDistribution ?? {});
    const p = new URLSearchParams({
      subcontractorId: selectedSubId,
      step: '1',
      sizeDistribution,
      soleOrderId: order.id,
    });
    const productId = subModalItem?.productId ?? order.productId;
    if (productId) p.set('productId', productId);
    router.push(`/subcontractor-orders/new?${p.toString()}`);
  };

  // Yeni gelen sipariş önce onaylanır (isteğe bağlı termin + not); sipariş verene bildirim gider
  const [confirmForm, setConfirmForm] = useState({ termin: '', note: '' });
  const handleConfirm = async () => {
    setSaving(true);
    setActionError('');
    const res = await fetch(`/api/orders/${params?.id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmedDeliveryDate: confirmForm.termin || undefined, note: confirmForm.note || undefined }),
    });
    if (!res.ok) setActionError((await res.json().catch(() => ({}))).error || 'Sipariş onaylanamadı');
    setSaving(false);
    loadOrder();
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.status) return;
    // "Sevk Edildi": sevk fişi kesilsin mi? Fiş son sevkiyatla siparişi zaten "Sevk Edildi" yapar ve hesaba işler
    if (statusForm.status === 'SHIPPED' && order.status !== 'SHIPPED'
      && window.confirm('Sevk fişi kesilsin mi?\n\nTamam: sevk fişi ekranı açılır (kalan miktarlar gelir, fiş yazdırılır ve isteğe bağlı cari hesaba işlenir).\nİptal: yalnızca durum "Sevk Edildi" yapılır.')) {
      router.push(`/sevkiyat/yeni?orderId=${order.id}`);
      return;
    }
    setSaving(true);
    setActionError('');
    const res = await fetch(`/api/orders/${params?.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: statusForm.status,
        statusNote: statusForm.note,
        confirmedDeliveryDate: statusForm.confirmedDeliveryDate || null,
      }),
    });
    if (!res.ok) setActionError((await res.json().catch(() => ({}))).error || 'Durum kaydedilemedi');
    else setStatusForm(f => ({ ...f, note: '' }));
    setSaving(false);
    loadOrder();
  };

  const handleShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setShipping(true);
    setActionError('');
    const res = await fetch(`/api/orders/${params?.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipment: {
          ...shipForm,
          ...(shipTarget ? { shipmentId: shipTarget } : { mode: 'new' }),
          final: shipFinal,
          // DecimalInput noktalı ondalık tutar ("490.5"); boş = sipariş miktarı
          items: shipLines(order).map(l => ({ index: l.index, shipped: shipQty[l.index] ? Number(shipQty[l.index]) : undefined })),
        },
      }),
    });
    setShipping(false);
    if (!res.ok) { setActionError((await res.json().catch(() => ({}))).error || 'Sevkiyat kaydedilemedi'); return; }
    setShowShipForm(false);
    loadOrder();
  };

  const handleCancel = async () => {
    setConfirmModal({ message: 'Siparişi iptal etmek istediğinizden emin misiniz?', onConfirm: async () => {
      await fetch(`/api/orders/${params?.id}`, { method: 'DELETE' });
      router.replace('/orders');
    }});
  };

  const handleConvert = () => {
    const p = new URLSearchParams({ orderId: String(params?.id) });
    if (order?.customerId) p.set('customerId', order.customerId);
    router.push(`/invoices/new?${p.toString()}`);
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-700" /></div></AppShell>;
  if (!order || order.error) return <AppShell><p className="text-ink-500">Sipariş bulunamadı.</p></AppShell>;

  const isPackage = Array.isArray(order.orderItems) && order.orderItems.length > 0;
  const pair = isPairUnit(order.unit);
  // Koli etiketi kaynakları: tek ürünlü siparişte ürün, paket siparişte her kalem
  const qtyOf = (sd: any) => Object.fromEntries(Object.entries(sd ?? {}).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => (v as number) > 0)) as Record<string, number>;
  const koliItems: KoliSource[] = isPackage
    ? (order.orderItems as any[]).map((it: any, i: number) => {
        const p = (order.itemProducts ?? []).find((x: any) => x.id === it.productId);
        return {
          key: String(i), label: [it.productCode, it.productName, it.color].filter(Boolean).join(' · ') || `Kalem ${i + 1}`,
          productId: it.productId ?? null, productCode: it.productCode ?? p?.code ?? null, productName: it.productName || p?.name || it.productCode || 'Ürün',
          unit: it.unit ?? order.unit ?? 'çift', color: it.color ?? null, sizes: p?.sizes ?? [], qty: qtyOf(it.sizeDistribution),
        };
      })
    : [{
        key: 'order', label: order.productCode || order.product?.name || 'Ürün',
        productId: order.productId ?? null, productCode: order.productCode ?? order.product?.code ?? null,
        productName: order.product?.name || order.productCode || 'Ürün', unit: order.unit ?? 'çift', color: order.color ?? null,
        sizes: order.product?.sizes ?? [], qty: qtyOf(order.sizeDistribution),
      }];
  const steps = nextStatuses(order.status, order.unit);
  const postedShipment = (Array.isArray(order.shipments) ? order.shipments : []).find((x: any) => x.invoiceId);
  const shipments: any[] = Array.isArray(order.shipments) ? order.shipments : order.shipment ? [order.shipment] : [];
  // Formdaki kalem satırları: "sipariş" sütunu kalan miktarı gösterir (düzenlenen sevkiyat hariç)
  const formLines = remainingLines(shipLines(order), shippedSoFar(shipments.filter(x => x.id !== shipTarget)))
    .map(l => ({ ...l, ordered: l.remaining }));
  const totalRemaining = remainingLines(shipLines(order), shippedSoFar(shipments)).reduce((a, l) => a + l.remaining, 0);
  const openShipForm = (sh: any | null) => {
    setShipTarget(sh?.id ?? null);
    setShipForm({
      shipmentDate: sh?.shipmentDate ? new Date(sh.shipmentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      deliveryNoteNo: sh?.deliveryNoteNo ?? '', carrier: sh?.carrier ?? '', trackingNo: sh?.trackingNo ?? '', notes: sh?.notes ?? '',
    });
    setShipQty(Array.isArray(sh?.items) ? Object.fromEntries(sh.items.map((i: any) => [i.index, String(i.shipped)])) : {});
    // Yeni sevkiyat varsayılan olarak kalanın tamamı: son sevkiyat işaretli gelir
    setShipFinal(sh ? order.status === 'SHIPPED' && sh.id === shipments[shipments.length - 1]?.id : true);
    setShowShipForm(true);
  };
  const source = order.link
    ? `SoleCost · ${order.link.buyerCompany?.name ?? 'bağlı firma'}`
    : order.portalCustomer ? `Portal · ${order.portalCustomer.email}` : 'Firma içi kayıt';
  const materialReqs = order.status === 'IN_PRODUCTION' ? calcMaterialReqs(order, materialsList) : [];

  return (
    <>
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <BackLink variant="icon" href="/orders" label="Gelen Siparişler" />
          <div className="flex-1 min-w-0">
            <h1 className="page-title">{order.orderNo}</h1>
            <p className="text-xs text-ink-400">
              {order.customer?.name} · {new Date(order.createdAt).toLocaleDateString('tr-TR')}
              <span className={`ml-1 ${order.link ? 'text-emerald-600 font-semibold' : 'text-brand-600'}`} data-testid="order-source">· {source}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && (
              <button onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors">
                <X className="w-4 h-4" /> İptal Et
              </button>
            )}
            {!isMaterial && pair && (
              <button onClick={() => setShowKoli(true)} data-testid="koli-open"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 rounded-lg text-sm font-medium transition-colors">
                <Package className="w-4 h-4" /> Koli Etiketi
              </button>
            )}
            <button onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 rounded-lg text-sm font-medium transition-colors">
              <Printer className="w-4 h-4" /> Üretim Çıktısı
            </button>
            {!isPackage && pair && (
              Array.isArray(order.subcontractorOrders) && order.subcontractorOrders.length > 0
                ? order.subcontractorOrders.map((so: any) => (
                    <Link key={so.id} href={`/subcontractors/${so.subcontractor.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-200">
                      <Factory className="w-4 h-4" /> {so.subcontractor.name}
                    </Link>
                  ))
                : (
                    <button onClick={() => { setSubModalItem(null); setShowSubModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
                      <Factory className="w-4 h-4" /> Fasoncuya Gönder
                    </button>
                  )
            )}
            {postedShipment ? (
              <Link href={`/invoices/${postedShipment.invoiceId}`} data-testid="order-posted"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-200"
                title="Sevkiyat sevk fişiyle cari hesaba işlendi; sipariş ayrıca satışa çevrilmez">
                <CheckCircle className="w-4 h-4" /> Sevk fişiyle hesaba işlendi
              </Link>
            ) : order.invoiceId ? (
              <Link href={`/invoices/${order.invoiceId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-200">
                <CheckCircle className="w-4 h-4" /> Fatura Görüntüle
              </Link>
            ) : (
              <button onClick={handleConvert}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium">
                <ShoppingCart className="w-4 h-4" /> Satışa Çevir
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">{actionError}</div>
        )}

        {/* Stepper */}
        <div className="bg-white rounded-xl p-5 shadow-card overflow-x-auto border border-ink-200/80">
          <OrderStepper status={order.status} unit={order.unit} />
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* LEFT — Sipariş Bilgileri + Beden */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
              <h2 className="font-semibold text-ink-700 mb-4">Sipariş Bilgileri</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                {[
                  ['Ürün', isPackage ? `${order.orderItems.length} kalem` : (order.productCode || order.product?.name || '—')],
                  ['Toplam Miktar', formatQty(order.totalQuantity, order.unit)],
                  ['Kaynak', source],
                  ['İstenen Termin', fmt(order.requestedDeliveryDate)],
                  ['Onaylanan Termin', fmt(order.confirmedDeliveryDate)],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-xs text-ink-400">{k}</dt>
                    <dd className="font-medium text-ink-700">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Hammadde Seçimleri */}
              {Array.isArray(order.partVariantsData) && order.partVariantsData.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-ink-400 mb-2 uppercase tracking-wide font-semibold">Hammadde Seçimleri</p>
                  <div className="space-y-1.5">
                    {(order.partVariantsData as any[]).map((pv: any) => {
                      const part = (order.product?.parts ?? []).find((p: any) => p.id === pv.partId);
                      const mat = materialsList.find((m: any) => m.id === pv.materialId) ?? part?.material;
                      return (
                        <div key={pv.partId} className="flex items-center gap-2">
                          <span className="w-20 flex-shrink-0 text-xs font-semibold text-ink-500 bg-ink-100 px-2 py-1.5 rounded-lg text-center">{part?.name ?? '—'}</span>
                          <span className="text-sm font-medium text-ink-700">{mat?.name ?? pv.materialId}</span>
                          {mat?.stock !== undefined && (
                            <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-lg ${mat.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                              {mat.stock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Renk Partileri */}
              {!isPackage && Array.isArray(order.colorPartials) && order.colorPartials.length > 0 && (
                <div className="mt-3">
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
              )}

              {/* Paket İçeriği */}
              {isPackage && (
                <div className="mt-3 overflow-x-auto">
                  <p className="text-xs text-ink-400 mb-2 uppercase tracking-wide font-semibold">Sipariş Kalemleri</p>
                  <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden">
                    <thead className="bg-ink-50">
                      <tr>{['Ürün', variantLabel(order.unit), ...(pair ? ['Beden'] : []), 'Miktar', ...(pair ? [''] : [])].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-500 border-b border-ink-200">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {(order.orderItems as any[]).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-ink-50">
                          <td className="px-3 py-2 text-xs">
                            <span className="font-semibold text-brand-700">{item.productCode || '—'}</span>
                            {item.productName && <span className="block text-ink-500">{item.productName}</span>}
                          </td>
                          <td className="px-3 py-2 text-ink-600 text-xs">{variantText({ ...item, unit: item.unit ?? order.unit }) || '—'}</td>
                          {pair && <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(item.sizeDistribution || {}).filter(([, q]) => (q as number) > 0).map(([sz, q]) => (
                                <span key={sz} className="px-1.5 py-0.5 bg-brand-50 text-brand-800 text-xs rounded font-medium">{sz}×{q as number}</span>
                              ))}
                            </div>
                          </td>}
                          <td className="px-3 py-2 font-semibold text-ink-800 text-xs whitespace-nowrap">{formatQty(item.totalQuantity, item.unit ?? order.unit)}</td>
                          {pair && <td className="px-3 py-2">
                            <button onClick={() => { setSubModalItem(item); setShowSubModal(true); }}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-medium">
                              <Factory className="w-3 h-3" /> Fasoncu
                            </button>
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Beden Dağılımı (yalnızca taban/çift siparişlerinde) */}
            {pair && <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
              <h2 className="font-semibold text-ink-700 mb-3">Beden Dağılımı</h2>
              <SizeTable
                value={order.sizeDistribution || {}}
                sizes={Object.keys(order.sizeDistribution || {}).filter(sz => (order.sizeDistribution?.[sz] || 0) > 0)}
                readOnly
              />
            </div>}
          </div>

          {/* RIGHT — Yönetim */}
          <div className="space-y-4">
            {order.status === 'ORDER_RECEIVED' && !order.confirmedAt && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3" data-testid="order-confirm-card">
                <h2 className="font-semibold text-amber-800">Sipariş onay bekliyor</h2>
                <p className="text-xs text-amber-700">Onaylayınca sipariş verene bildirim ve e-posta gider.</p>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Termin (isteğe bağlı)</label>
                  <input type="date" value={confirmForm.termin} onChange={e => setConfirmForm(f => ({ ...f, termin: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm bg-white" data-testid="confirm-termin" />
                </div>
                <input placeholder="Not (isteğe bağlı)" value={confirmForm.note} onChange={e => setConfirmForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm bg-white" />
                <button type="button" onClick={handleConfirm} disabled={saving} data-testid="order-confirm"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Siparişi onayla
                </button>
              </div>
            )}

            {/* Status update */}
            <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
              <h2 className="font-semibold text-ink-700 mb-4">Durum Güncelle</h2>
              <form onSubmit={handleStatusUpdate} className="space-y-3">
                <select value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none">
                  {steps.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  {!steps.some(s => s.key === statusForm.status) && statusForm.status && (
                    <option value={statusForm.status}>{statusLabel(statusForm.status, order.unit)}</option>
                  )}
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
                  Kaydet
                </button>
              </form>
            </div>

            {/* Shipment */}
            <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-ink-700">Sevkiyat</h2>
                {!showShipForm && order.status !== 'CANCELLED' && order.status !== 'SHIPPED' && (totalRemaining > 0 || shipments.length === 0) && (
                  <Link href={`/sevkiyat/yeni?orderId=${order.id}`} data-testid="order-dispatch"
                    className="ml-auto mr-2 flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium"
                    title="Sevk fişi kes: yazdır ve isteğe bağlı cari hesaba işle">
                    <Printer className="w-4 h-4" /> Sevk fişi kes
                  </Link>
                )}
                {!showShipForm && order.status !== 'CANCELLED' && (totalRemaining > 0 || shipments.length === 0) && (
                  <button data-testid="ship-open" onClick={() => openShipForm(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                    <Truck className="w-4 h-4" /> {shipments.length ? 'Yeni Sevkiyat' : 'Sevkiyat Ekle'}
                  </button>
                )}
              </div>
              {!showShipForm && (
                shipments.length ? (
                  <ShipmentList shipments={shipments} noteEndpoint={`/api/orders/${order.id}/delivery-note`} onEdit={sh => openShipForm(sh)} complete={order.status === 'SHIPPED'} />
                ) : <p className="text-sm text-ink-400">Henüz sevkiyat yok.</p>
              )}
              {showShipForm && (
                <form onSubmit={handleShipment} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-ink-500 mb-1">Sevk Tarihi *</label>
                    <input type="date" required value={shipForm.shipmentDate} onChange={e => setShipForm(f => ({ ...f, shipmentDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                  </div>
                  {[['deliveryNoteNo', 'İrsaliye No'], ['carrier', 'Taşıyıcı'], ['trackingNo', 'Takip No'], ['notes', 'Not']].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>
                      <input value={(shipForm as any)[field]} onChange={e => setShipForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                    </div>
                  ))}
                  <div className="col-span-2"><ShipQtyInputs lines={formLines} value={shipQty} onChange={setShipQty} remaining={shipments.length > 0 || !shipFinal} /></div>
                  <label className="col-span-2 flex items-start gap-2 text-sm text-ink-700">
                    <input type="checkbox" checked={shipFinal} onChange={e => setShipFinal(e.target.checked)} className="mt-0.5" data-testid="ship-final" />
                    <span>Son sevkiyat (sipariş tamamlandı)
                      <span className="block text-xs text-ink-500">{shipFinal ? 'Kaydedince sipariş "Sevk Edildi" olur ve müşteriye bildirim gider.' : 'Kısmi sevk: durum değişmez, müşteriye kısmi sevk bildirimi gider.'}</span>
                    </span>
                  </label>
                  <div className="col-span-2 flex gap-2">
                    <button type="button" onClick={() => setShowShipForm(false)}
                      className="px-4 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">İptal</button>
                    <button type="submit" disabled={shipping}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                      {shipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                      Kaydet
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Mesajlar ve talepler: yalnızca karşı taraf varsa (firma ağı ya da müşteri portalı) */}
            {order.messaging && (
              <OrderMessages endpoint={`/api/orders/${order.id}/messages`} viewer="staff" resolveBase={`/api/orders/${order.id}/messages`}
                subtitle={`${order.counterparty === 'network' ? 'Firma ağı' : 'Müşteri portalı'} · ${order.customer?.name ?? ''}`}
                refreshKey={msgKey} onChanged={() => { loadOrder(); setMsgKey(k => k + 1); }} />
            )}

            {/* Hammadde Gereksinimleri (IN_PRODUCTION) */}
            {order.status === 'IN_PRODUCTION' && materialReqs.length > 0 && (
              <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  <h2 className="font-semibold text-amber-800 text-sm">Hammadde Gereksinimi</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50 text-xs font-semibold text-ink-500 border-b">
                        <th className="px-4 py-2.5 text-left">Hammadde</th>
                        <th className="px-4 py-2.5 text-right">Gerekli (kg)</th>
                        <th className="px-4 py-2.5 text-right">Stok (kg)</th>
                        <th className="px-4 py-2.5 text-left">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {materialReqs.map(m => {
                        const ok = m.currentStock >= m.requiredKg;
                        return (
                          <tr key={m.materialId} className={ok ? '' : 'bg-red-50/40'}>
                            <td className="px-4 py-2.5 font-medium text-ink-700">{m.name}</td>
                            <td className="px-4 py-2.5 text-right text-ink-600">{m.requiredKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2.5 text-right text-ink-600">{m.currentStock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2.5">
                              {ok ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="w-3.5 h-3.5" /> Yeterli</span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Eksik ({(m.requiredKg - m.currentStock).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

        </div>
      </div>
      {showKoli && (
        <KoliLabelModal
          items={koliItems}
          customer={order.customer ? { id: order.customerId, name: order.customer.name } : null}
          order={{ id: order.id, orderNo: order.orderNo }}
          defaultMode={Object.keys(koliItems[0]?.qty ?? {}).length > 1 ? 'mixed' : 'single'}
          onClose={() => setShowKoli(false)}
        />
      )}
    </AppShell>

    {/* Fasoncuya Gönder Modal */}
    {showSubModal && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSubModal(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink-800 flex items-center gap-2">
              <Factory className="w-5 h-5 text-amber-500" /> Fasoncuya Gönder
            </h3>
            <button onClick={() => setShowSubModal(false)} className="p-1 text-ink-400 hover:text-ink-600 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
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
              className="flex-1 px-4 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">İptal</button>
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
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPrintModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-ink-200/80" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
            <h3 className="font-semibold text-ink-800">Üretim Çıktısı</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                const source = document.getElementById('order-print-content');
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
                setTimeout(() => { portal.remove(); style.remove(); }, 1000);
              }} className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium">
                <Printer className="w-4 h-4" /> Yazdır
              </button>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div id="order-print-content" className="p-8 space-y-6 text-sm">
            <div className="flex items-start justify-between border-b-2 border-ink-800 pb-4">
              <div>
                <p className="text-xs text-ink-500 uppercase tracking-widest font-semibold mb-1">Üretim Emri</p>
                <h2 className="text-2xl font-bold text-ink-800">{order.orderNo}</h2>
              </div>
              <div className="text-right text-xs text-ink-500 space-y-0.5">
                <p>Tarih: {new Date(order.createdAt).toLocaleDateString('tr-TR')}</p>
                {(order.confirmedDeliveryDate || order.requestedDeliveryDate) && (
                  <p>Termin: <span className="font-semibold text-ink-700">{fmt(order.confirmedDeliveryDate ?? order.requestedDeliveryDate)}</span></p>
                )}
              </div>
            </div>
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
                    {order.product?.name && <p className="text-xs text-ink-500">{order.product.name}</p>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Renk</p>
                    <p className="font-semibold text-ink-800">
                      {Array.isArray(order.colorPartials) && order.colorPartials.length > 0
                        ? (order.colorPartials as any[]).map((cp: any) => `${cp.name}: ${cp.color}`).join(' / ')
                        : order.color || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Malzeme</p>
                    <p className="font-semibold text-ink-800">{order.material || '—'}</p>
                  </div>
                </>
              )}
            </div>
            {isPackage && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Paket İçeriği</p>
                <table className="w-full text-sm border border-ink-200 rounded-lg overflow-hidden">
                  <thead className="bg-ink-50">
                    <tr>{['Model', variantLabel(order.unit), 'Beden Dağılımı', 'Adet'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-500 border-b">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {(order.orderItems as any[]).map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs font-semibold text-ink-700">{item.productCode || item.productName || '—'}</td>
                        <td className="px-3 py-2 text-xs text-ink-600">{variantText({ ...item, unit: item.unit ?? order.unit }) || '—'}</td>
                        <td className="px-3 py-2 text-xs text-ink-600">
                          {Object.entries(item.sizeDistribution || {}).filter(([, q]) => (q as number) > 0).map(([s, q]) => `${s}×${q}`).join(' ')}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-ink-800">{formatQty(item.totalQuantity, item.unit ?? order.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            {order.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Notlar</p>
                <p className="text-ink-700 bg-ink-50 rounded-lg p-3">{order.notes}</p>
              </div>
            )}
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
    {confirmModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-ink-800 mb-1">Emin misiniz?</h3>
              <p className="text-sm text-ink-600 whitespace-pre-line">{confirmModal.message}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-ink-50">İptal</button>
            <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
