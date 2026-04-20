'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Loader2, Plus, ClipboardList, ShoppingCart, CheckCircle, AlertTriangle } from 'lucide-react';

const STATUS_TABS = [
  { key: '', label: 'Tümü' },
  { key: 'ORDER_RECEIVED', label: 'Alındı' },
  { key: 'IN_PRODUCTION', label: 'Üretimde' },
  { key: 'MOLDING', label: 'Kalıplama' },
  { key: 'PAINTING', label: 'Boya/Apre' },
  { key: 'PACKAGING', label: 'Paketleme' },
  { key: 'READY_FOR_SHIPMENT', label: 'Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
  { key: 'CANCELLED', label: 'İptal' },
];

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Alındı',
  IN_PRODUCTION: 'Üretimde',
  MOLDING: 'Kalıplama',
  PAINTING: 'Boya/Apre',
  PACKAGING: 'Paketleme',
  READY_FOR_SHIPMENT: 'Hazır',
  SHIPPED: 'Sevk Edildi',
  CANCELLED: 'İptal',
};

const STATUS_COLORS: Record<string, string> = {
  ORDER_RECEIVED: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-amber-100 text-amber-700',
  MOLDING: 'bg-orange-100 text-orange-700',
  PAINTING: 'bg-purple-100 text-purple-700',
  PACKAGING: 'bg-cyan-100 text-cyan-700',
  READY_FOR_SHIPMENT: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR') : '—';

export default function OrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('');
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

        {/* Orders table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sipariş bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3 text-left">Sipariş No</th>
                    <th className="px-4 py-3 text-left">Müşteri</th>
                    <th className="px-4 py-3 text-left">Model</th>
                    <th className="px-4 py-3 text-right">Adet</th>
                    <th className="px-4 py-3 text-left">Termin</th>
                    <th className="px-4 py-3 text-left">Durum</th>
                    <th className="px-4 py-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700">{order.orderNo}</td>
                      <td className="px-4 py-3 text-slate-600">{order.customer?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{order.productCode || order.product?.code || order.product?.name || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{order.totalQuantity}</td>
                      <td className="px-4 py-3 text-slate-500">{fmt(order.requestedDeliveryDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {order.invoiceId ? (
                            <Link href={`/invoices/${order.invoiceId}`}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100">
                              <CheckCircle className="w-3.5 h-3.5" /> Fatura
                            </Link>
                          ) : order.status !== 'CANCELLED' && (
                            <button onClick={() => handleConvert(order)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100">
                              <ShoppingCart className="w-3.5 h-3.5" /> Satışa Çevir
                            </button>
                          )}
                          <Link href={`/orders/${order.id}`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                            Yönet
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
