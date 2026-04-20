'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Loader2, Plus, ClipboardList, ShoppingCart, CheckCircle, AlertTriangle } from 'lucide-react';

const STATUS_TABS = [
  { key: 'ORDER_RECEIVED', label: 'Bekliyor' },
  { key: 'IN_PRODUCTION', label: 'Üretimde' },
  { key: 'READY_FOR_SHIPMENT', label: 'Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
];

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Bekliyor',
  IN_PRODUCTION: 'Üretimde',
  READY_FOR_SHIPMENT: 'Hazır',
  SHIPPED: 'Sevk Edildi',
  CANCELLED: 'İptal',
};

const STATUS_BORDER: Record<string, string> = {
  ORDER_RECEIVED: 'border-blue-400',
  IN_PRODUCTION: 'border-amber-400',
  READY_FOR_SHIPMENT: 'border-green-400',
  SHIPPED: 'border-emerald-400',
  CANCELLED: 'border-red-300',
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR') : '—';

export default function OrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ORDER_RECEIVED');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uretimData, setUretimData] = useState<{ orders: any[]; materialRequirements: any[] } | null>(null);
  const [uretimLoading, setUretimLoading] = useState(false);

  const loadOrders = useCallback(() => {
    setLoading(true);
    const url = activeTab ? `/api/orders?status=${activeTab}` : '/api/orders';
    fetch(url)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (activeTab !== 'IN_PRODUCTION') { setUretimData(null); return; }
    setUretimLoading(true);
    fetch('/api/orders/uretim')
      .then(r => r.json())
      .then(d => setUretimData(d))
      .finally(() => setUretimLoading(false));
  }, [activeTab]);

  const handleConvert = (order: any) => {
    const params = new URLSearchParams({ orderId: order.id });
    if (order.customerId) params.set('customerId', order.customerId);
    router.push(`/invoices/new?${params.toString()}`);
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

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
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

        {/* Orders list */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-16 text-slate-400 text-sm">Sipariş bulunamadı</div>
        ) : (
          <div className="space-y-2">
            {orders.map((order: any) => (
              <div key={order.id} className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${STATUS_BORDER[order.status] ?? 'border-slate-300'}`}>
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{order.orderNo}</span>
                      {order.invoiceId && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Faturalandı
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5">
                      <span className="font-medium">{order.customer?.name ?? '—'}</span>
                      {(order.productCode || order.product?.code || order.product?.name) && (
                        <span className="text-slate-400"> · {order.productCode || order.product?.code || order.product?.name}</span>
                      )}
                      <span className="text-slate-400"> · </span>
                      <span className="font-semibold text-slate-600">{order.totalQuantity} çift</span>
                    </p>
                    {order.requestedDeliveryDate && (
                      <p className="text-xs text-slate-400 mt-0.5">Termin: {fmt(order.requestedDeliveryDate)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {order.invoiceId ? (
                      <Link href={`/invoices/${order.invoiceId}`}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100">
                        <CheckCircle className="w-3.5 h-3.5" /> Fatura
                      </Link>
                    ) : order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && (
                      <button onClick={() => handleConvert(order)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100">
                        <ShoppingCart className="w-3.5 h-3.5" /> Satışa Çevir
                      </button>
                    )}
                    <Link href={`/orders/${order.id}`}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                      Yönet →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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
