'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import {
  Loader2, ChevronLeft, Pencil, Save, X, Factory, Package,
  ArrowUpDown, Plus, CheckCircle2, Mail,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', MATERIAL_SENT: 'Hammadde Gönderildi',
  IN_PRODUCTION: 'Üretimde', IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', MATERIAL_SENT: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700', IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700', RECEIVED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function SubcontractorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalForm, setPortalForm] = useState({ email: '', password: '', name: '' });
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'stock' | 'orders' | 'transfers'>('info');

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/subcontractors/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.error) {
          setData(d);
          setEditForm({ name: d.name, contactPerson: d.contactPerson || '', phone: d.phone || '', address: d.address || '', email: d.email || '', isActive: d.isActive });
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/subcontractors/${params.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      });
      setEditing(false);
      load();
    } finally { setSaving(false); }
  };

  const handlePortalRegister = async () => {
    setPortalSaving(true);
    try {
      const res = await fetch(`/api/subcontractors/${params.id}/portal-register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(portalForm),
      });
      if (res.ok) { setShowPortalModal(false); load(); }
      else { const d = await res.json(); alert(d.error); }
    } finally { setPortalSaving(false); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></AppShell>;
  if (!data) return <AppShell><div className="text-center py-16 text-slate-400">Fasoncu bulunamadı</div></AppShell>;

  const tabs = [
    { id: 'info', label: 'Bilgiler' },
    { id: 'stock', label: `Zimmet (${data.materialStocks?.length ?? 0})` },
    { id: 'orders', label: `Aktif Siparişler (${data.subcontractorOrders?.length ?? 0})` },
    { id: 'transfers', label: `Transferler (${data.materialTransfers?.length ?? 0})` },
  ];

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium">
              <Pencil className="w-4 h-4" /> Düzenle
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
              </button>
              <button onClick={() => { setEditing(false); load(); }} className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
                <X className="w-4 h-4" /> Vazgeç
              </button>
            </>
          )}
          {!data.portalCustomer && (
            <button onClick={() => setShowPortalModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Portal Hesabı Oluştur
            </button>
          )}
          <Link href="/subcontractor-orders/new" className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Yeni Sipariş
          </Link>
        </div>

        {/* Header */}
        <div className="bg-orange-600 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <Factory className="w-6 h-6 text-orange-200" />
            <div>
              <p className="text-white font-bold text-lg">{data.name}</p>
              {data.contactPerson && <p className="text-orange-200 text-sm">{data.contactPerson}</p>}
              {data.portalCustomer && (
                <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Portal: {data.portalCustomer.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {[
                { key: 'name', label: 'Firma Adı' },
                { key: 'contactPerson', label: 'İletişim' },
                { key: 'phone', label: 'Telefon' },
                { key: 'email', label: 'E-posta' },
                { key: 'address', label: 'Adres' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center px-4 py-3 gap-3">
                  <span className="text-xs font-semibold text-slate-400 w-24 flex-shrink-0">{label}</span>
                  {editing ? (
                    <input value={editForm[key] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-orange-400" />
                  ) : (
                    <span className="text-sm text-slate-700">{data[key] || <span className="text-slate-300 italic">—</span>}</span>
                  )}
                </div>
              ))}
              {editing && (
                <div className="flex items-center px-4 py-3 gap-3">
                  <span className="text-xs font-semibold text-slate-400 w-24">Aktif</span>
                  <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm((p: any) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stock/Zimmet Tab */}
        {activeTab === 'stock' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {data.materialStocks?.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Zimmetli hammadde yok</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3 text-left">Hammadde</th>
                  <th className="px-4 py-3 text-left">Renk/Varyant</th>
                  <th className="px-4 py-3 text-right">Miktar</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.materialStocks?.map((s: any) => (
                    <tr key={s.id} className={s.quantity <= 0 ? 'bg-red-50/30' : ''}>
                      <td className="px-4 py-3 font-medium text-slate-700">{s.material?.name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.materialVariant ? `${s.materialVariant.colorName}${s.materialVariant.code ? ` (${s.materialVariant.code})` : ''}` : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {s.quantity.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Active Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {data.subcontractorOrders?.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Aktif sipariş yok</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3 text-left">Sipariş No</th>
                  <th className="px-4 py-3 text-left">Ürün</th>
                  <th className="px-4 py-3 text-right">Adet</th>
                  <th className="px-4 py-3 text-center">Durum</th>
                  <th className="px-4 py-3 text-right">Termin</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.subcontractorOrders?.map((o: any) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3">
                        <Link href={`/subcontractor-orders/${o.id}`} className="text-blue-600 hover:underline font-medium">{o.orderNo}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{o.product?.name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">{o.totalPairs}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {o.dueDate ? new Date(o.dueDate).toLocaleDateString('tr-TR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Transfers Tab */}
        {activeTab === 'transfers' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {data.materialTransfers?.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Transfer geçmişi yok</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-left">Hammadde</th>
                  <th className="px-4 py-3 text-center">Yön</th>
                  <th className="px-4 py-3 text-right">Miktar</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.materialTransfers?.map((t: any) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {t.material?.name}
                        {t.materialVariant && <span className="text-slate-400 ml-1 text-xs">({t.materialVariant.colorName})</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${t.direction === 'OUTGOING' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          <ArrowUpDown className="w-2.5 h-2.5" />
                          {t.direction === 'OUTGOING' ? 'Gönderildi' : 'Alındı'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {t.quantity.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Portal Register Modal */}
      {showPortalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPortalModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-orange-600 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Portal Hesabı Oluştur</h3>
              <button onClick={() => setShowPortalModal(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">Fasoncuya giriş yapabileceği bir portal hesabı oluşturulacak ve aktivasyon maili gönderilecek.</p>
              {[
                { key: 'email', label: 'E-posta *', type: 'email', placeholder: 'fasoncu@firma.com' },
                { key: 'password', label: 'Şifre *', type: 'password', placeholder: '••••••••' },
                { key: 'name', label: 'Kullanıcı Adı', type: 'text', placeholder: data.contactPerson || data.name },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input type={type} value={(portalForm as any)[key]} onChange={e => setPortalForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={handlePortalRegister} disabled={portalSaving || !portalForm.email || !portalForm.password}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                  {portalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Oluştur ve Mail Gönder
                </button>
                <button onClick={() => setShowPortalModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
