'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, ChevronRight, SlidersHorizontal,
  AlertTriangle, Clock, Loader2, PackageOpen, Check,
} from 'lucide-react';

interface OrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  productName: string;
  productCode: string | null;
  totalQuantity: number;
  dueDate: string | null;
  status: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
}

interface WidgetData {
  stats: {
    totalPending: number;
    todayDue: number;
    overdue: number;
    inProduction: number;
    awaitingApproval: number;
  };
  alerts: { overdueCount: number; todayDueCount: number };
  orders: OrderRow[];
}

const STATUS_LABEL: Record<string, string> = {
  ORDER_RECEIVED: 'Onay Bekliyor',
  IN_PRODUCTION: 'Üretimde',
  MOLDING: 'Kalıpta',
  PAINTING: 'Boyamada',
  PACKAGING: 'Paketlemede',
  READY_FOR_SHIPMENT: 'Hazır',
};

const IN_PRODUCTION_SET = new Set(['IN_PRODUCTION', 'MOLDING', 'PAINTING', 'PACKAGING']);

function getStatusBadge(order: OrderRow) {
  if (order.isOverdue) return { label: 'Gecikti', cls: 'bg-red-100 text-red-700 border border-red-200' };
  if (IN_PRODUCTION_SET.has(order.status)) return { label: STATUS_LABEL[order.status] ?? 'Hazırlanıyor', cls: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (order.status === 'ORDER_RECEIVED') return { label: 'Onay Bekliyor', cls: 'bg-blue-100 text-blue-700 border border-blue-200' };
  if (order.status === 'READY_FOR_SHIPMENT') return { label: 'Hazır', cls: 'bg-green-100 text-green-700 border border-green-200' };
  return { label: STATUS_LABEL[order.status] ?? order.status, cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
}

function getPriority(order: OrderRow) {
  if (order.isOverdue || order.isDueToday)
    return { dot: 'bg-red-500', label: 'Kritik', cls: 'text-red-600' };
  if (order.isDueSoon)
    return { dot: 'bg-amber-400', label: 'Yakın', cls: 'text-amber-600' };
  return { dot: 'bg-green-400', label: 'Normal', cls: 'text-green-600' };
}

function formatDue(dueDate: string | null, isOverdue: boolean, isDueToday: boolean): { text: string; cls: string } {
  if (!dueDate) return { text: '—', cls: 'text-slate-400' };
  if (isOverdue) {
    const days = Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return { text: `${days} gün önce`, cls: 'text-red-600 font-semibold' };
  }
  if (isDueToday) return { text: 'Bugün', cls: 'text-orange-600 font-semibold' };
  return {
    text: new Date(dueDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
    cls: 'text-slate-600',
  };
}

const FILTER_OPTIONS = [
  { key: null, label: 'Tümü' },
  { key: 'OVERDUE', label: 'Gecikmiş' },
  { key: 'TODAY', label: 'Bugün Teslim' },
  { key: 'ORDER_RECEIVED', label: 'Onay Bekliyor' },
  { key: 'IN_PRODUCTION', label: 'Hazırlanıyor' },
  { key: 'READY_FOR_SHIPMENT', label: 'Hazır' },
];

export default function PendingOrdersWidget({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/dashboard/pending-orders')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    const all = data.orders;
    if (!filterKey) return all;
    if (filterKey === 'OVERDUE') return all.filter(o => o.isOverdue);
    if (filterKey === 'TODAY') return all.filter(o => o.isDueToday);
    if (filterKey === 'IN_PRODUCTION') return all.filter(o => IN_PRODUCTION_SET.has(o.status));
    return all.filter(o => o.status === filterKey);
  }, [data, filterKey]);

  const displayOrders = filteredOrders.slice(0, 5);
  const remaining = filteredOrders.length - 5;

  const stats = data?.stats;
  const alerts = data?.alerts;

  const KPI_ITEMS = stats ? [
    { label: 'Toplam Bekleyen', value: stats.totalPending, cls: 'text-slate-800', bg: 'bg-slate-50 border-slate-200' },
    { label: 'Bugün Teslim', value: stats.todayDue, cls: stats.todayDue > 0 ? 'text-orange-600' : 'text-slate-800', bg: stats.todayDue > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200' },
    { label: 'Geciken', value: stats.overdue, cls: stats.overdue > 0 ? 'text-red-600' : 'text-slate-800', bg: stats.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200' },
    { label: 'Hazırlanıyor', value: stats.inProduction, cls: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    { label: 'Onay Bekliyor', value: stats.awaitingApproval, cls: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  ] : [];

  const activeFilterLabel = FILTER_OPTIONS.find(o => o.key === filterKey)?.label ?? 'Filtrele';

  const inner = (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-base">Bekleyen Siparişler</h2>
            {stats && stats.totalPending > 0 && (
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                {stats.totalPending}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter button */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filterKey
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterLabel}
            </button>

            <AnimatePresence>
              {showFilter && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 z-20 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 min-w-[160px]"
                >
                  {FILTER_OPTIONS.map(opt => (
                    <button
                      key={String(opt.key)}
                      onClick={() => { setFilterKey(opt.key); setShowFilter(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                        filterKey === opt.key ? 'text-blue-600 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {opt.label}
                      {filterKey === opt.key && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/orders"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            Tümünü Gör <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      ) : !data || stats?.totalPending === 0 ? (
        /* Empty state */
        <div className="py-14 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <PackageOpen className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm font-medium">Bekleyen sipariş yok</p>
          <p className="text-slate-400 text-xs mt-1">Tüm siparişler tamamlandı</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-slate-100 border-b border-slate-100">
            {KPI_ITEMS.map(k => (
              <div key={k.label} className={`flex flex-col items-center justify-center py-3 px-2 ${k.bg} border`}>
                <span className={`text-xl font-bold tabular-nums ${k.cls}`}>{k.value}</span>
                <span className="text-xs text-slate-500 mt-0.5 text-center leading-tight">{k.label}</span>
              </div>
            ))}
          </div>

          {/* Alert banners */}
          {(alerts && (alerts.overdueCount > 0 || alerts.todayDueCount > 0)) && (
            <div className="px-5 pt-3.5 pb-1 space-y-2">
              {alerts.overdueCount > 0 && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span className="font-medium">{alerts.overdueCount} sipariş gecikmiş durumda</span>
                </div>
              )}
              {alerts.todayDueCount > 0 && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
                  <Clock className="w-4 h-4 flex-shrink-0 text-orange-500" />
                  <span className="font-medium">{alerts.todayDueCount} sipariş bugün teslim edilmeli</span>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {displayOrders.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">Bu filtreyle eşleşen sipariş yok</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Sipariş No</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Müşteri</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Ürün / Model</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Adet</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Termin</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Durum</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Öncelik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayOrders.map((order, i) => {
                    const badge = getStatusBadge(order);
                    const priority = getPriority(order);
                    const due = formatDue(order.dueDate, order.isOverdue, order.isDueToday);
                    const rowHighlight = order.isOverdue
                      ? 'bg-red-50/40 hover:bg-red-50/70'
                      : order.isDueToday
                      ? 'bg-orange-50/40 hover:bg-orange-50/70'
                      : 'hover:bg-slate-50/60';

                    return (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className={`group cursor-pointer transition-colors ${rowHighlight}`}
                      >
                        <td className="px-5 py-3">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className="font-bold text-blue-600 text-sm tracking-wide hover:underline">
                              #{order.orderNo}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className="text-slate-800 font-medium text-sm truncate max-w-[140px] block">{order.customerName}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className="text-slate-700 text-sm truncate max-w-[160px] block">{order.productName}</span>
                            {order.productCode && (
                              <span className="text-xs text-slate-400">{order.productCode}</span>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className="font-semibold text-slate-700 tabular-nums">
                              {order.totalQuantity.toLocaleString('tr-TR')}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">çift</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className={`text-sm ${due.cls}`}>{due.text}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <Link href={`/orders/${order.id}`} className="block">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${priority.cls}`}>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`} />
                              {priority.label}
                            </span>
                          </Link>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer — remaining count */}
          {remaining > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
              <span className="text-xs text-slate-500">{remaining} sipariş daha gösterilmiyor</span>
              <Link
                href="/orders"
                className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
              >
                Tümünü Gör <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100"
    >
      {inner}
    </motion.div>
  );
}
