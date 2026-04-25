'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import {
  Loader2, Plus, ClipboardList, CheckCircle, AlertTriangle,
  Pencil, ChevronDown, Factory, Truck,
} from 'lucide-react';

const STATUS_TABS = [
  { key: 'ORDER_RECEIVED', label: 'Bekliyor' },
  { key: 'IN_PRODUCTION', label: 'Üretimde' },
  { key: 'READY_FOR_SHIPMENT', label: 'Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
];

const STATUS_BORDER: Record<string, string> = {
  ORDER_RECEIVED: 'border-blue-400',
  IN_PRODUCTION: 'border-amber-400',
  READY_FOR_SHIPMENT: 'border-green-400',
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
    fetch('/api/customers')
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
      .then(r => r.json())
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

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-slate-600" />
            <h1 className="text-xl font-bold text-slate-800">Siparişler</h1>
          </div>
          <Link href="/orders/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Yeni Sipariş
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm divide-y divide-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

            {/* Müşteri */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Müşteri</span>
              <select
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Tümü</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sipariş Tarihi */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sipariş Tarihi</span>
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
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="1w">Son 1 Hafta</option>
                <option value="1m">Son 1 Ay</option>
                <option value="3m">Son 3 Ay</option>
                <option value="custom">Gelişmiş Arama</option>
              </select>
              {datePreset === 'custom' && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-slate-400 text-xs">—</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              )}
            </div>

            {/* Termin Tarihi */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Termin Tarihi</span>
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
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-slate-400 text-xs">—</span>
                  <input type="date" value={terminTo} onChange={e => setTerminTo(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Status tabs + bulk actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bulk action dropdown */}
          {selectedIds.size > 0 && (
            <div className="relative flex-shrink-0" ref={bulkRef}>
              <button
                onClick={() => setBulkOpen(o => !o)}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {bulkLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><span className="text-slate-300 text-xs">{selectedIds.size} seçili</span><span className="mx-1 text-slate-500">|</span>Toplu İşlem<ChevronDown className="w-3.5 h-3.5" /></>
                }
              </button>
              {bulkOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[180px]">
                  {BULK_ACTIONS.map(action => (
                    <button
                      key={action.key}
                      onClick={() => handleBulkStatus(action.key, action.note)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left transition-colors"
                    >
                      <action.icon className="w-4 h-4 text-slate-400" />
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
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-16 text-slate-400 text-sm">Sipariş bulunamadı</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[32px_160px_1fr_1fr_110px_110px_80px_52px] items-center px-4 py-2.5 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide min-w-[860px]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onClick={e => e.stopPropagation()}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-blue-400 cursor-pointer"
                />
                <span>Sipariş No</span>
                <span>Müşteri</span>
                <span>Taban</span>
                <span>Sipariş Tarihi</span>
                <span>Termin</span>
                <span className="text-right">Adet</span>
                <span></span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100 min-w-[860px]">
                {orders.map((order: any) => {
                  const productCode = order.productCode || order.product?.code;
                  const productName = order.product?.name;
                  const isOverdue = !order.invoiceId && order.requestedDeliveryDate && new Date(order.requestedDeliveryDate) < new Date();
                  const isSelected = selectedIds.has(order.id);
                  return (
                    <div
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className={`grid grid-cols-[32px_160px_1fr_1fr_110px_110px_80px_52px] items-center px-4 py-3 border-l-4 ${STATUS_BORDER[order.status] ?? 'border-slate-300'} ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'} cursor-pointer transition-colors`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleOne(order.id)}
                        className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                      />

                      {/* Sipariş No */}
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-sm">{order.orderNo}</span>
                        {order.invoiceId && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 text-[10px] font-medium">
                            <CheckCircle className="w-3 h-3" /> Faturalandı
                          </span>
                        )}
                      </div>

                      {/* Müşteri */}
                      <div className="text-sm text-slate-700 font-medium truncate pr-2">
                        {order.customer?.name ?? '—'}
                      </div>

                      {/* Taban */}
                      <div className="flex flex-col gap-0.5 pr-2">
                        {productCode && <span className="text-xs font-semibold text-slate-500">{productCode}</span>}
                        {productName && <span className="text-xs text-slate-600 truncate">{productName}</span>}
                        {!productCode && !productName && <span className="text-xs text-slate-400">—</span>}
                      </div>

                      {/* Sipariş Tarihi */}
                      <div className="text-xs text-slate-500">{fmt(order.createdAt)}</div>

                      {/* Termin */}
                      <div className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                        {isOverdue && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                        {order.requestedDeliveryDate ? fmt(order.requestedDeliveryDate) : '—'}
                      </div>

                      {/* Adet */}
                      <div className="text-sm font-semibold text-slate-700 text-right">
                        {order.totalQuantity}
                        <span className="text-xs font-normal text-slate-400 ml-0.5">çift</span>
                      </div>

                      {/* Düzenle */}
                      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <Link href={`/orders/${order.id}`}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
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
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
              <h2 className="font-semibold text-amber-800 text-sm">Hammadde Gereksinimi (Üretimde)</h2>
            </div>
            {uretimLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : !uretimData || uretimData.materialRequirements.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Hesaplanacak hammadde kaydı yok</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left">Hammadde</th>
                      <th className="px-4 py-2.5 text-right">Gerekli (kg)</th>
                      <th className="px-4 py-2.5 text-right">Stok (kg)</th>
                      <th className="px-4 py-2.5 text-left">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {uretimData.materialRequirements.map((m: any) => {
                      const ok = m.currentStock >= m.requiredKg;
                      return (
                        <tr key={m.materialId} className={ok ? '' : 'bg-red-50/40'}>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{m.name}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{m.requiredKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{m.currentStock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
