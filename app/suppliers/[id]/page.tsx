'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { ArrowLeft, Loader2, Pencil, Save, X, Phone, Mail, MapPin, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

const statusLabel: Record<string, string> = {
  DRAFT: 'Taslak', PENDING: 'Bekliyor', PARTIAL: 'Kısmi', PAID: 'Ödendi', CANCELLED: 'İptal',
};
const statusColor: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-orange-100 text-orange-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function SupplierDetailPage() {
  const { formatCurrency } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/suppliers/${params.id}`)
      .then(r => r.json())
      .then(d => { setSupplier(d); setForm(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params?.id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/suppliers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSupplier({ ...supplier, ...form });
    setEditing(false);
    setSaving(false);
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  if (!supplier || supplier.error) return <AppShell><div className="text-center py-12 text-slate-400">Tedarikçi bulunamadı</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{supplier.name}</h1>
              {supplier.taxId && <p className="text-slate-500 text-sm">VKN: {supplier.taxId}</p>}
            </div>
          </div>
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors">
            <Pencil className="w-4 h-4" /> Düzenle
          </button>
        </div>

        {/* Borç özeti */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
            <p className="text-xs text-slate-500 mb-1">Toplam Alış</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(supplier.totalPurchased)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
            <p className="text-xs text-slate-500 mb-1">Toplam Ödeme</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(supplier.totalPaid)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${supplier.balance > 0 ? 'border-red-500' : 'border-slate-300'}`}>
            <p className="text-xs text-slate-500 mb-1">Borç Bakiyesi</p>
            <p className={`text-xl font-bold ${supplier.balance > 0 ? 'text-red-600' : 'text-slate-600'}`}>{formatCurrency(supplier.balance)}</p>
          </motion.div>
        </div>

        {/* Bilgiler */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">Tedarikçi Bilgileri</h2>
            {editing && (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Kaydet
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[['name','Firma Adı'], ['taxId','VKN'], ['phone','Telefon'], ['email','E-posta']].map(([f, l]) => (
                <div key={f}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                  <input value={form[f] ?? ''} onChange={e => setForm((p: any) => ({...p, [f]: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Adres</label>
                <textarea value={form.address ?? ''} onChange={e => setForm((p: any) => ({...p, address: e.target.value}))} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notlar</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm((p: any) => ({...p, notes: e.target.value}))} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {supplier.phone && <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4 text-slate-400" />{supplier.phone}</div>}
              {supplier.email && <div className="flex items-center gap-2 text-slate-600"><Mail className="w-4 h-4 text-slate-400" />{supplier.email}</div>}
              {supplier.taxId && <div className="flex items-center gap-2 text-slate-600"><Hash className="w-4 h-4 text-slate-400" />VKN: {supplier.taxId}</div>}
              {supplier.address && <div className="flex items-center gap-2 text-slate-600 sm:col-span-2"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />{supplier.address}</div>}
              {supplier.notes && <div className="sm:col-span-2 text-slate-500 italic text-xs">{supplier.notes}</div>}
            </div>
          )}
        </div>

        {/* Alışlar */}
        {supplier.purchases?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-slate-700">Alışlar</h2>
            </div>
            <div className="divide-y">
              {supplier.purchases.map((p: any) => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{p.invoiceNo || 'Faturasız'}</p>
                    <p className="text-xs text-slate-400">{new Date(p.date).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status]}`}>{statusLabel[p.status]}</span>
                    <span className="font-semibold text-slate-700 text-sm">{formatCurrency(p.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
