'use client';

import { canEditOrders } from '@/lib/access';
import { formatQty } from '@/lib/order-units';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import {
  Loader2, Plus, ClipboardList, CheckCircle, AlertTriangle,
  Pencil, ChevronDown, Factory, Truck, Printer,
} from '@/app/components/icons';
import { useSession } from 'next-auth/react';
import { ordersHtml } from '@/lib/order-print';
import { productsHtml, summarizeByProduct, type ProductSummary } from '@/lib/order-summary';

const STATUS_TABS = [
  { key: 'ORDER_RECEIVED', label: 'Bekliyor' },
  { key: 'IN_PRODUCTION', label: 'Üretimde' },
  { key: 'READY_FOR_SHIPMENT', label: 'Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
  { key: 'CANCELLED', label: 'İptal' },
];

const STATUS_BORDER: Record<string, string> = {
  ORDER_RECEIVED: 'border-brand-500',
  IN_PRODUCTION: 'border-amber-400',
  MOLDING: 'border-amber-400',
  PAINTING: 'border-amber-400',
  PACKAGING: 'border-amber-400',
  READY_FOR_SHIPMENT: 'border-emerald-400',
  SHIPPED: 'border-emerald-400',
  CANCELLED: 'border-red-300',
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR') : '—';

function defaultDateFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
}

type DatePreset = '1w' | '1m' | '3m' | 'custom';

function presetRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().split('T')[0];
  const from = new Date(today);
  if (preset === '1w') from.setDate(from.getDate() - 7);
  else if (preset === '1m') from.setMonth(from.getMonth() - 1);
  else if (preset === '3m') from.setMonth(from.getMonth() - 3);
  return { from: from.toISOString().split('T')[0], to };
}

function terminPresetRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const to = new Date(today);
  if (preset === '1w') to.setDate(to.getDate() + 7);
  else if (preset === '1m') to.setMonth(to.getMonth() + 1);
  else if (preset === '3m') to.setMonth(to.getMonth() + 3);
  return { from, to: to.toISOString().split('T')[0] };
}

const BULK_ACTIONS = [
  { key: 'IN_PRODUCTION', label: 'Üretime Gönder', icon: Factory, note: 'Toplu üretime alındı' },
  { key: 'READY_FOR_SHIPMENT', label: 'Sevke Gönder', icon: Truck, note: 'Toplu sevke hazır' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession() || {};
  // Salt okunur (usta): yeni sipariş ve toplu durum değişikliği yok
  const editable = canEditOrders(session?.user as any);
  const [activeTab, setActiveTab] = useState('ORDER_RECEIVED');
  const [datePreset, setDatePreset] = useState<DatePreset>('1m');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [terminPreset, setTerminPreset] = useState<DatePreset | ''>('');
  const [terminFrom, setTerminFrom] = useState('');
  const [terminTo, setTerminTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  // Görünüm: sipariş sipariş ya da ürün bazında (bekleyen siparişlerde hangi üründen toplam ne kadar)
  const [view, setView] = useState<'order' | 'product'>('order');
  const productSummary = useMemo(() => (view === 'product' ? summarizeByProduct(orders) : []), [orders, view]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uretimData, setUretimData] = useState<{ orders: any[]; materialRequirements: any[] } | null>(null);
  const [uretimLoading, setUretimLoading] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bulkRef.current && !bulkRef.current.contains(e.target as Node)) setBulkOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    // Filtre için yalnız müşteri adları (bakiye yok)
    fetch('/api/customers?minimal=true')
      .then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : (d.customers ?? [])))
      .catch(() => {});
  }, []);

  const loadOrders = useCallback(() => {
    setLoading(true);
    setSelectedIds(new Set());
    const params = new URLSearchParams({ status: activeTab });
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (terminFrom) params.set('terminFrom', terminFrom);
    if (terminTo) params.set('terminTo', terminTo);
    if (customerFilter) params.set('customerId', customerFilter);
    fetch(`/api/orders?${params.toString()}`)
      .then(r => { setOrdersTotal(Number(r.headers.get('X-Total-Count') ?? 0)); return r.json(); })
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [activeTab, dateFrom, dateTo, terminFrom, terminTo, customerFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (activeTab !== 'IN_PRODUCTION') { setUretimData(null); return; }
    setUretimLoading(true);
    fetch('/api/orders/uretim')
      .then(r => r.json())
      .then(d => setUretimData(d))
      .finally(() => setUretimLoading(false));
  }, [activeTab]);

  const handleBulkStatus = async (status: string, note: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    setBulkOpen(false);
    await Promise.all(
      Array.from(selectedIds).map(id =>
        fetch(`/api/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, statusNote: note }),
        })
      )
    );
    setBulkLoading(false);
    loadOrders();
  };

  const allSelected = orders.length > 0 && orders.every(o => selectedIds.has(o.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map(o => o.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Sipariş föyü: seçili siparişler, seçim yoksa sekmedeki liste. Gizli çerçevede yazdırma penceresi açılır;
  // "PDF olarak kaydet" ile PDF alınır. Mobil uygulamayla aynı HTML (lib/order-print).
  const printOrders = () => {
    const list = selectedIds.size ? orders.filter(o => selectedIds.has(o.id)) : orders;
    if (!list.length) return;
    const tab = STATUS_TABS.find(t => t.key === activeTab)?.label ?? '';
    const title = selectedIds.size ? 'Seçili siparişler'
      : activeTab === 'ORDER_RECEIVED' ? 'Bekleyen siparişler' : activeTab === 'ALL' ? 'Siparişler' : `Siparişler — ${tab}`;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    const opts = { title: view === 'product' ? `${title} — ürün bazında` : title, companyName: (session?.user as any)?.companyName ?? null };
    doc.open();
    doc.write(view === 'product' ? productsHtml(summarizeByProduct(list), opts) : ordersHtml(list, opts));
    doc.close();
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60_000);
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-ink-600" />
            <h1 className="page-title">Gelen Siparişler</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={printOrders} disabled={loading || orders.length === 0} data-testid="orders-print"
              title={selectedIds.size ? 'Seçili siparişleri yazdır' : 'Bu sekmedeki siparişleri yazdır'}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-ink-200 hover:bg-ink-50 text-ink-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              <Printer className="w-4 h-4" /> Yazdır / PDF{selectedIds.size ? ` (${selectedIds.size})` : ''}
            </button>
            {editable && <Link href="/orders/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Yeni Sipariş
            </Link>}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-card divide-y divide-ink-100 border border-ink-200/80">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-ink-100">

            {/* Müşteri */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Müşteri</span>
              <select
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
              >
                <option value="">Tümü</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sipariş Tarihi */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Sipariş Tarihi</span>
              <select
                value={datePreset}
                onChange={e => {
                  const v = e.target.value as DatePreset;
                  setDatePreset(v);
                  if (v !== 'custom') {
                    const r = presetRange(v);
                    setDateFrom(r.from);
                    setDateTo(r.to);
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
              >
                <option value="1w">Son 1 Hafta</option>
                <option value="1m">Son 1 Ay</option>
                <option value="3m">Son 3 Ay</option>
                <option value="custom">Gelişmiş Arama</option>
              </select>
              {datePreset === 'custom' && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-600 outline-none" />
                  <span className="text-ink-400 text-xs">—</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-600 outline-none" />
                </div>
              )}
            </div>

            {/* Termin Tarihi */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Termin Tarihi</span>
              <select
                value={terminPreset}
                onChange={e => {
                  const v = e.target.value as DatePreset | '';
                  setTerminPreset(v);
                  if (v === '') { setTerminFrom(''); setTerminTo(''); }
                  else if (v !== 'custom') {
                    const r = terminPresetRange(v);
                    setTerminFrom(r.from);
                    setTerminTo(r.to);
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
              >
                <option value="">Tümü</option>
                <option value="1w">Gelecek 1 Hafta</option>
                <option value="1m">Gelecek 1 Ay</option>
                <option value="3m">Gelecek 3 Ay</option>
                <option value="custom">Gelişmiş Arama</option>
              </select>
              {terminPreset === 'custom' && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input type="date" value={terminFrom} onChange={e => setTerminFrom(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-600 outline-none" />
                  <span className="text-ink-400 text-xs">—</span>
                  <input type="date" value={terminTo} onChange={e => setTerminTo(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-600 outline-none" />
                </div>
              )}
            </div>

          </div>
        </div>

        {ordersTotal > orders.length && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {ordersTotal.toLocaleString('tr-TR')} siparişin en yeni {orders.length.toLocaleString('tr-TR')} tanesi gösteriliyor. Tarih veya müşteri filtresiyle aramayı daraltın.
          </div>
        )}

        {/* Status tabs + bulk actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-white text-ink-600 hover:bg-ink-100 border border-ink-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Görünüm: sipariş sipariş ya da ürün bazında toplam */}
          <div className="flex flex-shrink-0 rounded-lg border border-ink-200 bg-white p-0.5" role="tablist" data-testid="orders-view">
            {([['order', 'Sipariş'], ['product', 'Ürün bazında']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === k ? 'bg-ink-800 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Bulk action dropdown */}
          {editable && view === 'order' && selectedIds.size > 0 && (
            <div className="relative flex-shrink-0" ref={bulkRef}>
              <button
                onClick={() => setBulkOpen(o => !o)}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-800 hover:bg-ink-900 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {bulkLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><span className="text-ink-300 text-xs">{selectedIds.size} seçili</span><span className="mx-1 text-ink-500">|</span>Toplu İşlem<ChevronDown className="w-3.5 h-3.5" /></>
                }
              </button>
              {bulkOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-ink-100 py-1 min-w-[180px]">
                  {BULK_ACTIONS.map(action => (
                    <button
                      key={action.key}
                      onClick={() => handleBulkStatus(action.key, action.note)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 text-left transition-colors"
                    >
                      <action.icon className="w-4 h-4 text-ink-400" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Orders table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-700" /></div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card text-center py-16 border border-ink-200/80">
            <ClipboardList className="w-12 h-12 text-ink-200 mx-auto mb-3" />
            <p className="text-ink-400 text-sm mb-3">Henüz sipariş yok</p>
            {editable && <Link href="/orders/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> İlk siparişi oluştur
            </Link>}
          </div>
        ) : view === 'product' ? (
          <ProductSummaryTable summary={productSummary} />
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[24px_minmax(0,1.1fr)_minmax(0,1fr)_auto_auto] gap-x-2 sm:gap-x-0 sm:grid-cols-[32px_160px_1fr_1fr_110px_110px_80px_52px] items-center px-4 py-2.5 bg-ink-50 text-ink-500 text-[11px] font-semibold uppercase tracking-[0.08em] border-b border-ink-200">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onClick={e => e.stopPropagation()}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-brand-500 cursor-pointer"
                />
                <span>Sipariş No</span>
                <span>Müşteri</span>
                <span className="hidden sm:block">Ürün</span>
                <span className="hidden sm:block">Sipariş Tarihi</span>
                <span>Termin</span>
                <span className="text-right">Miktar</span>
                <span className="hidden sm:block"></span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-ink-100">
                {orders.map((order: any) => {
                  const items: any[] = Array.isArray(order.orderItems) ? order.orderItems : [];
                  // Paket siparişte ilk kalemler ve kalem sayısı; tekli siparişte ürün
                  const productCode = items.length > 1
                    ? items.slice(0, 2).map(i => i.productCode || i.productName).filter(Boolean).join(', ') + (items.length > 2 ? '…' : '')
                    : (order.productCode || order.product?.code);
                  const productName = items.length > 1 ? `${items.length} kalem` : (items[0]?.productName || order.product?.name);
                  const isOverdue = !order.invoiceId && order.requestedDeliveryDate && new Date(order.requestedDeliveryDate) < new Date();
                  const isSelected = selectedIds.has(order.id);
                  return (
                    <div
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className={`grid grid-cols-[24px_minmax(0,1.1fr)_minmax(0,1fr)_auto_auto] gap-x-2 sm:gap-x-0 sm:grid-cols-[32px_160px_1fr_1fr_110px_110px_80px_52px] items-center px-4 py-3 border-l-4 ${STATUS_BORDER[order.status] ?? 'border-ink-300'} ${isSelected ? 'bg-brand-50/60' : 'hover:bg-ink-50/80'} cursor-pointer transition-colors`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleOne(order.id)}
                        className="w-3.5 h-3.5 accent-brand-600 cursor-pointer"
                      />

                      {/* Sipariş No */}
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-ink-800 text-sm">{order.orderNo}</span>
                        {order.status === 'ORDER_RECEIVED' && !order.confirmedAt && (
                          <span className="w-fit px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold align-middle" data-testid={`order-unconfirmed-${order.id}`}>Onay bekliyor</span>
                        )}
                        {order.openRequest && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold w-fit" data-testid={`order-request-${order.id}`}>
                            {order.openRequest === 'CANCEL_REQUEST' ? 'İptal talebi' : 'Değişiklik talebi'}
                          </span>
                        )}
                        {order.unreadMessages > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-brand-700 text-white text-[10px] font-semibold w-fit" data-testid={`order-unread-${order.id}`}>
                            {order.unreadMessages} yeni mesaj
                          </span>
                        )}
                        {order.invoiceId && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 text-[10px] font-medium">
                            <CheckCircle className="w-3 h-3" /> Faturalandı
                          </span>
                        )}
                      </div>

                      {/* Müşteri */}
                      <div className="text-sm text-ink-700 font-medium truncate pr-2">
                        {order.customer?.name ?? '—'}
                        {order.link && (
                          <span className="block text-[11px] font-semibold text-emerald-600" data-testid={`order-source-${order.id}`}>SoleCost · {order.link.buyerCompany?.name}</span>
                        )}
                      </div>

                      {/* Taban */}
                      <div className="hidden sm:flex flex-col gap-0.5 pr-2">
                        {productCode && <span className="text-xs font-semibold text-ink-500">{productCode}</span>}
                        {productName && <span className="text-xs text-ink-600 truncate">{productName}</span>}
                        {!productCode && !productName && <span className="text-xs text-ink-400">—</span>}
                      </div>

                      {/* Sipariş Tarihi */}
                      <div className="hidden sm:block text-xs text-ink-500">{fmt(order.createdAt)}</div>

                      {/* Termin */}
                      <div className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-ink-500'}`}>
                        {isOverdue && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                        {order.requestedDeliveryDate ? fmt(order.requestedDeliveryDate) : '—'}
                      </div>

                      {/* Adet */}
                      <div className="text-sm font-semibold text-ink-700 text-right">
                        {formatQty(order.totalQuantity, order.unit).split(' ')[0]}
                        <span className="text-xs font-normal text-ink-400 ml-0.5">{formatQty(0, order.unit).split(' ').slice(1).join(' ')}</span>
                      </div>

                      {/* Düzenle */}
                      <div className="hidden sm:flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <Link href={`/orders/${order.id}`}
                          className="p-1.5 rounded-lg hover:bg-ink-200 text-ink-500 hover:text-ink-700 transition-colors"
                          title="Düzenle">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Üretim hammadde gereksinim tablosu */}
        {activeTab === 'IN_PRODUCTION' && (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
              <h2 className="font-semibold text-amber-800 text-sm">Hammadde Gereksinimi (Üretimde)</h2>
            </div>
            {uretimLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : !uretimData || uretimData.materialRequirements.length === 0 ? (
              <div className="text-center py-8 text-ink-400 text-sm">Hesaplanacak hammadde kaydı yok</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 text-xs font-semibold text-ink-500 border-b border-ink-100">
                      <th className="px-4 py-2.5 text-left">Hammadde</th>
                      <th className="px-4 py-2.5 text-right">Gerekli (kg)</th>
                      <th className="px-4 py-2.5 text-right">Stok (kg)</th>
                      <th className="px-4 py-2.5 text-left">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {uretimData.materialRequirements.map((m: any) => {
                      const ok = m.currentStock >= m.requiredKg;
                      return (
                        <tr key={m.materialId} className={ok ? '' : 'bg-red-50/40'}>
                          <td className="px-4 py-2.5 font-medium text-ink-700">{m.name}</td>
                          <td className="px-4 py-2.5 text-right text-ink-600">{m.requiredKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-right text-ink-600">{m.currentStock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5">
                            {ok ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <CheckCircle className="w-3.5 h-3.5" /> Yeterli
                              </span>
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
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Ürün bazında görünüm: ürün başına toplam, beden dağılımı, en yakın termin; satıra tıklayınca siparişler açılır
function ProductSummaryTable({ summary }: { summary: ProductSummary[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sizeText = (d: Record<string, number>) => Object.entries(d)
    .sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true })).map(([s, q]) => `${s}×${q}`).join(' · ');
  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80" data-testid="orders-product-table">
      <div className="grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_2fr_90px_130px_120px] gap-3 px-4 py-2.5 bg-ink-50 text-ink-500 text-[11px] font-semibold uppercase tracking-[0.08em] border-b border-ink-200">
        <span>Ürün</span><span className="hidden sm:block">Bedenler</span><span className="hidden sm:block text-center">Sipariş</span>
        <span className="hidden sm:block">En yakın termin</span><span className="text-right">Toplam</span>
      </div>
      {summary.map(s => (
        <div key={s.key} className="border-b border-ink-100 last:border-0">
          <button type="button" onClick={() => setOpen(k => (k === s.key ? null : s.key))} aria-expanded={open === s.key}
            className="w-full grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_2fr_90px_130px_120px] gap-3 items-center px-4 py-3 text-left hover:bg-ink-50 text-sm">
            <span className="min-w-0">
              <span className="font-semibold text-ink-800">{s.productCode ? `${s.productCode} · ` : ''}{s.productName || 'Ürün'}</span>
              <span className="block text-xs text-ink-500">{s.customers.length} müşteri</span>
            </span>
            <span className="hidden sm:block text-xs text-ink-600 truncate">{sizeText(s.sizeDistribution) || '—'}</span>
            <span className="hidden sm:block text-center text-ink-700">{s.orderCount}</span>
            <span className="hidden sm:block text-ink-600">{s.earliestDue ? new Date(s.earliestDue).toLocaleDateString('tr-TR') : '—'}</span>
            <span className="text-right font-bold text-ink-800">{formatQty(s.totalQuantity, s.unit)}</span>
          </button>
          {open === s.key && (
            <div className="px-4 pb-3 space-y-1">
              {s.orders.map(o => (
                <Link key={o.orderNo} href={o.id ? `/orders/${o.id}` : '#'}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm bg-ink-50 hover:bg-brand-50">
                  <span className="truncate"><span className="font-medium text-ink-800">{o.orderNo}</span> · {o.customer || '—'}</span>
                  <span className="flex items-center gap-4 text-ink-600 shrink-0">
                    {o.due ? <span className="text-xs">Termin {new Date(o.due).toLocaleDateString('tr-TR')}</span> : null}
                    <span className="font-semibold text-ink-800">{formatQty(o.quantity, s.unit)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
