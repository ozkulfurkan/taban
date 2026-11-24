'use client';

import { formatQty } from '@/lib/order-units';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Users, List, Plus, Loader2, Eye, EyeOff, Trash2, Globe, X, RotateCcw, AlertTriangle } from '@/app/components/icons';

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Sipariş Alındı', IN_PRODUCTION: 'Üretimde', MOLDING: 'Kalıplama',
  PAINTING: 'Boya/Apre', PACKAGING: 'Paketleme', READY_FOR_SHIPMENT: 'Sevkiyata Hazır',
  SHIPPED: 'Sevk Edildi', CANCELLED: 'İptal Edildi',
};
const STATUS_COLOR: Record<string, string> = {
  ORDER_RECEIVED: 'bg-brand-100 text-brand-800', IN_PRODUCTION: 'bg-amber-100 text-amber-700',
  MOLDING: 'bg-brand-100 text-brand-800', PAINTING: 'bg-brand-100 text-brand-800',
  PACKAGING: 'bg-yellow-100 text-yellow-700', READY_FOR_SHIPMENT: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-ink-100 text-ink-500',
};

function MsgBadges({ order }: { order: any }) {
  if (!order.openRequest && !(order.unreadMessages > 0)) return null;
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {order.openRequest && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">{order.openRequest === 'CANCEL_REQUEST' ? 'İptal talebi' : 'Değişiklik talebi'}</span>}
      {order.unreadMessages > 0 && <span className="px-1.5 py-0.5 rounded bg-brand-700 text-white text-[10px] font-semibold">{order.unreadMessages} yeni mesaj</span>}
    </span>
  );
}

export default function PortalAdminPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const user = session?.user as any;

  const [tab, setTab] = useState<'customers' | 'orders'>('orders');
  const [portalCustomers, setPortalCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [orderTab, setOrderTab] = useState<'active' | 'cancelled'>('active');
  const [showPrices, setShowPrices] = useState<boolean | null>(null);
  const [pageError, setPageError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // New portal customer form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ customerId: '', email: '', name: '', password: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Customer search combobox
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return; }
    if (status !== 'authenticated') return;
    Promise.all([
      fetch('/api/portal/customers').then(r => r.json()),
      fetch('/api/portal/orders').then(r => r.json()),
      fetch('/api/company').then(r => r.json()).catch(() => null),
    ]).then(([pc, ord, co]) => {
      if (typeof co?.portalShowPrices === 'boolean') setShowPrices(co.portalShowPrices);
      setPortalCustomers(Array.isArray(pc) ? pc : []);
      setOrders(Array.isArray(ord) ? ord : []);
    }).finally(() => setLoading(false));
  }, [status, router]);

  const searchCustomers = async (q: string) => {
    setCustomerQuery(q);
    setFormData(f => ({ ...f, customerId: '' }));
    setSelectedCustomerName('');
    if (!q.trim()) { setCustomerResults([]); setShowCustomerList(false); return; }
    setCustomerSearching(true);
    setShowCustomerList(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page=1`);
      const data = await res.json();
      setCustomerResults(Array.isArray(data.customers) ? data.customers : []);
    } finally { setCustomerSearching(false); }
  };

  const selectCustomer = (c: any) => {
    setFormData(f => ({ ...f, customerId: c.id }));
    setSelectedCustomerName(c.name);
    setCustomerQuery(c.name);
    setShowCustomerList(false);
    setCustomerResults([]);
  };

  const handleCreatePortalCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const res = await fetch('/api/portal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Hata oluştu'); return; }
      setPortalCustomers(prev => [...prev, data]);
      setShowForm(false);
      setFormData({ customerId: '', email: '', name: '', password: '' });
      setCustomerQuery(''); setSelectedCustomerName(''); setCustomerResults([]);
      if (data.emailSent === false) alert(`Hesap açıldı ama ${data.email} adresine doğrulama e-postası gönderilemedi. Giriş bilgilerini müşteriye ayrıca iletin.`);
    } finally { setFormLoading(false); }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/portal/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setPortalCustomers(prev => prev.map(p => p.id === id ? { ...p, isActive: !isActive } : p));
  };

  const deletePortalCustomer = async (id: string) => {
    setConfirmModal({ message: 'Bu portal kullanıcısını silmek istediğinize emin misiniz?', onConfirm: async () => {
      await fetch(`/api/portal/customers/${id}`, { method: 'DELETE' });
      setPortalCustomers(prev => prev.filter(p => p.id !== id));
    }});
  };

  const setOrderStatus = async (id: string, next: string) => {
    setPageError('');
    const res = await fetch(`/api/portal/orders/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) { setPageError((await res.json().catch(() => ({}))).error || 'Durum değiştirilemedi'); return; }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
  };
  const cancelOrder = (id: string) => {
    setConfirmModal({ message: 'Bu siparişi iptal etmek istediğinize emin misiniz?', onConfirm: () => setOrderStatus(id, 'CANCELLED') });
  };
  const restoreOrder = (id: string) => setOrderStatus(id, 'ORDER_RECEIVED');

  // Ö3: portalda fiyat gösterimi (yalnızca firma sahibi/yönetici değiştirebilir)
  const canEditCompany = ['ADMIN', 'COMPANY_OWNER'].includes(user?.role);
  const togglePrices = async () => {
    if (showPrices === null) return;
    const next = !showPrices;
    setShowPrices(next); setPageError('');
    const res = await fetch('/api/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ portalShowPrices: next }) });
    if (!res.ok) { setShowPrices(!next); setPageError('Ayar kaydedilemedi'); }
  };

  const deleteOrder = async (id: string) => {
    setConfirmModal({ message: 'Bu sipariş kalıcı olarak silinecek.', onConfirm: async () => {
      const res = await fetch(`/api/portal/orders/${id}`, { method: 'DELETE' });
      if (res.ok) setOrders(prev => prev.filter(o => o.id !== id));
    }});
  };

  const visibleOrders = orders
    .filter(o => orderTab === 'cancelled' ? o.status === 'CANCELLED' : o.status !== 'CANCELLED')
    .filter(o => !filterStatus || o.status === filterStatus);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-brand-700" />
          <h1 className="page-title">Müşteri Portalı Yönetimi</h1>
        </div>

        {canEditCompany && showPrices !== null && (
          <label className="flex items-start gap-3 bg-white rounded-xl border border-ink-200/80 shadow-card px-4 py-3 cursor-pointer w-fit max-w-full">
            <input type="checkbox" checked={showPrices} onChange={togglePrices} className="mt-1 accent-brand-700" data-testid="portal-show-prices" />
            <span className="text-sm text-ink-700">
              <b>Portalda fiyatları göster</b>
              <span className="block text-xs text-ink-500">Müşteri katalogda birim fiyatı (müşteriye özel fiyat varsa onu) ve siparişte tahmini tutarı görür.</span>
            </span>
          </label>
        )}
        {pageError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{pageError}</div>}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-ink-200">
          {(['orders', 'customers'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand-700 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}>
              {t === 'orders' ? <><List className="w-4 h-4" /> Siparişler ({orders.length})</> : <><Users className="w-4 h-4" /> Portal Kullanıcıları ({portalCustomers.length})</>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-brand-700" /></div>
        ) : tab === 'orders' ? (
          <div className="space-y-4">
            {/* Active / Cancelled tabs */}
            <div className="flex gap-1 bg-white rounded-xl shadow-card p-1 border border-ink-100 w-fit">
              {([{ key: 'active', label: 'Aktif' }, { key: 'cancelled', label: 'İptal Edilenler' }] as const).map(({ key, label }) => (
                <button key={key} onClick={() => { setOrderTab(key); setFilterStatus(''); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${orderTab === key ? 'bg-brand-100 text-brand-800' : 'text-ink-600 hover:text-ink-900'}`}>
                  {label}
                  {key === 'cancelled' && orders.filter(o => o.status === 'CANCELLED').length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-ink-200 text-ink-600 rounded-full text-xs">
                      {orders.filter(o => o.status === 'CANCELLED').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Status filter — only for active tab */}
            {orderTab === 'active' && (
              <div className="flex gap-2 flex-wrap">
                {['', ...Object.keys(STATUS_LABELS).filter(s => s !== 'CANCELLED')].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterStatus === s ? 'bg-brand-700 text-white' : 'bg-white text-ink-600 hover:bg-ink-100 border border-ink-200'
                    }`}>
                    {s ? STATUS_LABELS[s] : `Tümü`}
                  </button>
                ))}
              </div>
            )}

            {/* Telefonda kart listesi */}
            <ul className="sm:hidden space-y-2" data-testid="portal-admin-cards">
              {visibleOrders.map(order => (
                <li key={order.id} className="bg-white rounded-xl shadow-card border border-ink-200/80 p-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-800">{order.orderNo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[order.status] ?? 'bg-ink-100 text-ink-600'}`}>{STATUS_LABELS[order.status] ?? order.status}</span>
                    </div>
                    <p className="text-sm text-ink-600 mt-0.5 truncate">{order.customer?.name}</p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {order.productCode || order.product?.name || '—'} · {formatQty(order.totalQuantity, order.unit)}
                      {order.requestedDeliveryDate ? ` · ${new Date(order.requestedDeliveryDate).toLocaleDateString('tr-TR')}` : ''}
                    </p>
                    <MsgBadges order={order} />
                  </Link>
                  <div className="flex gap-2 mt-2">
                    {orderTab === 'active' ? (
                      <button onClick={() => cancelOrder(order.id)} className="px-2.5 py-1 rounded-lg border border-ink-200 text-xs text-ink-600">İptal Et</button>
                    ) : (
                      <>
                        <button onClick={() => restoreOrder(order.id)} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">Geri Al</button>
                        <button onClick={() => deleteOrder(order.id)} className="px-2.5 py-1 rounded-lg border border-ink-200 text-xs text-red-600">Kalıcı Sil</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 border-b border-ink-200">
                    <tr>
                      {['Sipariş No', 'Müşteri', 'Model', 'Adet', 'Termin', 'Durum', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {visibleOrders.map(order => (
                      <tr key={order.id} className="hover:bg-ink-50">
                        <td className="px-4 py-3 font-medium text-ink-800 whitespace-nowrap">{order.orderNo}<MsgBadges order={order} /></td>
                        <td className="px-4 py-3 text-ink-600">{order.customer?.name}</td>
                        <td className="px-4 py-3 text-ink-600">{order.productCode || order.product?.name || '—'}</td>
                        <td className="px-4 py-3 text-ink-600">{formatQty(order.totalQuantity, order.unit)}</td>
                        <td className="px-4 py-3 text-ink-500 text-xs">
                          {order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString('tr-TR') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-ink-100 text-ink-600'}`}>
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {orderTab === 'active' ? (
                              <>
                                <Link href={`/orders/${order.id}`}
                                  className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg text-xs font-medium transition-colors">
                                  Yönet
                                </Link>
                                <button onClick={() => cancelOrder(order.id)}
                                  className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="İptal Et">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => restoreOrder(order.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors">
                                  <RotateCcw className="w-3 h-3" /> Geri Al
                                </button>
                                <button onClick={() => deleteOrder(order.id)}
                                  className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Kalıcı Sil">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium text-sm transition-colors">
                <Plus className="w-4 h-4" /> Portal Kullanıcısı Ekle
              </button>
            </div>

            {showForm && (
              <div className="bg-white rounded-xl p-5 shadow-card border border-brand-100">
                <h3 className="font-semibold text-ink-700 mb-4">Yeni Portal Kullanıcısı</h3>
                {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
                <form onSubmit={handleCreatePortalCustomer} className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-xs font-medium text-ink-500 mb-1">Müşteri</label>
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={e => searchCustomers(e.target.value)}
                      onFocus={() => { if (customerResults.length > 0) setShowCustomerList(true); }}
                      onBlur={() => setTimeout(() => setShowCustomerList(false), 150)}
                      placeholder="Müşteri adı ile arayın..."
                      autoComplete="off"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none ${formData.customerId ? 'border-brand-500 bg-brand-50' : 'border-ink-200'}`}
                    />
                    {/* Hidden required validation */}
                    <input type="text" required value={formData.customerId} onChange={() => {}} className="sr-only" tabIndex={-1} />
                    {customerSearching && (
                      <Loader2 className="absolute right-3 top-8 w-4 h-4 animate-spin text-ink-400" />
                    )}
                    {showCustomerList && customerResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {customerResults.map(c => (
                          <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 text-ink-700 flex flex-col">
                            <span className="font-medium">{c.name}</span>
                            {(c.phone || c.email) && <span className="text-xs text-ink-400">{c.phone || c.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {showCustomerList && !customerSearching && customerResults.length === 0 && customerQuery.trim() && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg px-3 py-2 text-sm text-ink-400">
                        Sonuç bulunamadı
                      </div>
                    )}
                    {formData.customerId && selectedCustomerName && (
                      <p className="text-xs text-brand-700 mt-0.5">✓ {selectedCustomerName} seçildi</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">Ad Soyad</label>
                    <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">E-posta</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">Geçici Şifre</label>
                    <input required value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="px-4 py-2 border border-ink-200 rounded-lg text-sm font-medium text-ink-600 hover:bg-ink-50">İptal</button>
                    <button type="submit" disabled={formLoading}
                      className="px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                      {formLoading && <Loader2 className="w-4 h-4 animate-spin" />} Oluştur & Mail Gönder
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 border-b border-ink-200">
                  <tr>
                    {['Ad', 'E-posta', 'Müşteri', 'Durum', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {portalCustomers.map(pc => (
                    <tr key={pc.id} className="hover:bg-ink-50">
                      <td className="px-4 py-3 font-medium text-ink-800">{pc.name || '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{pc.email}</td>
                      <td className="px-4 py-3 text-ink-600">{pc.customer?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${pc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {pc.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button onClick={() => toggleActive(pc.id, pc.isActive)}
                          className="p-1.5 text-ink-400 hover:text-ink-700 rounded hover:bg-ink-100 transition-colors" title={pc.isActive ? 'Pasif Yap' : 'Aktif Yap'}>
                          {pc.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deletePortalCustomer(pc.id)}
                          className="p-1.5 text-ink-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
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
    </AppShell>
  );
}
