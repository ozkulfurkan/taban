'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Users, List, Plus, Loader2, Eye, EyeOff, Trash2, Globe } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Sipariş Alındı', IN_PRODUCTION: 'Üretimde', MOLDING: 'Kalıplama',
  PAINTING: 'Boya/Apre', PACKAGING: 'Paketleme', READY_FOR_SHIPMENT: 'Sevkiyata Hazır', SHIPPED: 'Sevk Edildi',
};
const STATUS_COLOR: Record<string, string> = {
  ORDER_RECEIVED: 'bg-blue-100 text-blue-700', IN_PRODUCTION: 'bg-orange-100 text-orange-700',
  MOLDING: 'bg-purple-100 text-purple-700', PAINTING: 'bg-pink-100 text-pink-700',
  PACKAGING: 'bg-yellow-100 text-yellow-700', READY_FOR_SHIPMENT: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700',
};

export default function PortalAdminPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const user = session?.user as any;

  const [tab, setTab] = useState<'customers' | 'orders'>('orders');
  const [portalCustomers, setPortalCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

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
    ]).then(([pc, ord]) => {
      setPortalCustomers(Array.isArray(pc) ? pc : []);
      setOrders(Array.isArray(ord) ? ord : []);
    }).finally(() => setLoading(false));
  }, [status, router]);

  const filteredOrders = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

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
    if (!confirm('Bu portal kullanıcısını silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/portal/customers/${id}`, { method: 'DELETE' });
    setPortalCustomers(prev => prev.filter(p => p.id !== id));
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Müşteri Portalı Yönetimi</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {(['orders', 'customers'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'orders' ? <><List className="w-4 h-4" /> Siparişler ({orders.length})</> : <><Users className="w-4 h-4" /> Portal Kullanıcıları ({portalCustomers.length})</>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : tab === 'orders' ? (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {['', ...Object.keys(STATUS_LABELS)].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}>
                  {s ? STATUS_LABELS[s] : `Tümü (${orders.length})`}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Sipariş No', 'Müşteri', 'Model', 'Adet', 'Termin', 'Durum', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{order.orderNo}</td>
                        <td className="px-4 py-3 text-slate-600">{order.customer?.name}</td>
                        <td className="px-4 py-3 text-slate-600">{order.productCode || order.product?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{order.totalQuantity}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString('tr-TR') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/portal-admin/orders/${order.id}`}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">
                            Yönet
                          </Link>
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
                <Plus className="w-4 h-4" /> Portal Kullanıcısı Ekle
              </button>
            </div>

            {showForm && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100">
                <h3 className="font-semibold text-slate-700 mb-4">Yeni Portal Kullanıcısı</h3>
                {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
                <form onSubmit={handleCreatePortalCustomer} className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Müşteri</label>
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={e => searchCustomers(e.target.value)}
                      onFocus={() => { if (customerResults.length > 0) setShowCustomerList(true); }}
                      onBlur={() => setTimeout(() => setShowCustomerList(false), 150)}
                      placeholder="Müşteri adı ile arayın..."
                      autoComplete="off"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${formData.customerId ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                    />
                    {/* Hidden required validation */}
                    <input type="text" required value={formData.customerId} onChange={() => {}} className="sr-only" tabIndex={-1} />
                    {customerSearching && (
                      <Loader2 className="absolute right-3 top-8 w-4 h-4 animate-spin text-slate-400" />
                    )}
                    {showCustomerList && customerResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {customerResults.map(c => (
                          <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-slate-700 flex flex-col">
                            <span className="font-medium">{c.name}</span>
                            {(c.phone || c.email) && <span className="text-xs text-slate-400">{c.phone || c.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {showCustomerList && !customerSearching && customerResults.length === 0 && customerQuery.trim() && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm text-slate-400">
                        Sonuç bulunamadı
                      </div>
                    )}
                    {formData.customerId && selectedCustomerName && (
                      <p className="text-xs text-blue-600 mt-0.5">✓ {selectedCustomerName} seçildi</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Ad Soyad</label>
                    <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">E-posta</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Geçici Şifre</label>
                    <input required value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">İptal</button>
                    <button type="submit" disabled={formLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                      {formLoading && <Loader2 className="w-4 h-4 animate-spin" />} Oluştur & Mail Gönder
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Ad', 'E-posta', 'Müşteri', 'Durum', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {portalCustomers.map(pc => (
                    <tr key={pc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{pc.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{pc.email}</td>
                      <td className="px-4 py-3 text-slate-600">{pc.customer?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${pc.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {pc.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button onClick={() => toggleActive(pc.id, pc.isActive)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors" title={pc.isActive ? 'Pasif Yap' : 'Aktif Yap'}>
                          {pc.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deletePortalCustomer(pc.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
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
    </AppShell>
  );
}
