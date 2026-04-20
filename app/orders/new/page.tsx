'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import SizeTable from '@/app/portal/components/size-table';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

export default function NewOrderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  const [form, setForm] = useState({
    customerId: '',
    productId: '',
    productCode: '',
    requestedDeliveryDate: '',
    notes: '',
  });
  const [sizeDistribution, setSizeDistribution] = useState<Record<string, number>>({});
  const [partMaterials, setPartMaterials] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (d.customers ?? [])));
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
    fetch('/api/materials').then(r => r.json()).then(d => setMaterials(Array.isArray(d) ? d : []));
  }, []);

  const handleProductChange = (productId: string) => {
    setForm(f => ({ ...f, productId }));
    if (!productId) { setSelectedProduct(null); setPartMaterials({}); setColorPartials({}); return; }
    const p = products.find((p: any) => p.id === productId);
    setSelectedProduct(p ?? null);
    if (p) {
      setForm(f => ({ ...f, productCode: p.code || p.name }));
      const defaults: Record<string, string> = {};
      for (const part of (p.parts ?? [])) {
        if (part.materialId) defaults[part.id] = part.materialId;
      }
      setPartMaterials(defaults);
      setSizeDistribution({});
    }
  };

  const totalQty = Object.values(sizeDistribution).reduce((s, v) => s + (Number(v) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) return alert('Müşteri seçin');
    if (totalQty === 0) return alert('En az 1 adet girin');

    const partVariantsData = Object.entries(partMaterials)
      .filter(([, matId]) => matId)
      .map(([partId, materialId]) => ({ partId, materialId }));

    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          productId: form.productId || null,
          productCode: form.productCode || null,
          sizeDistribution,
          requestedDeliveryDate: form.requestedDeliveryDate || null,
          notes: form.notes || null,
          partVariantsData: partVariantsData.length > 0 ? partVariantsData : null,
        }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/orders/${data.id}`);
      } else {
        alert(data.error || 'Hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Yeni Sipariş</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Müşteri */}
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Müşteri Bilgisi</h2>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Müşteri *</label>
              <select required value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="">— Müşteri Seçin —</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Ürün */}
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Ürün Bilgisi</h2>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Kataloğu</label>
              <select value={form.productId} onChange={e => handleProductChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="">— Katalogdan Seç —</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
              </select>
            </div>
            {/* Hammadde Seçimi — ürünün parts'ı varsa */}
            {selectedProduct && (selectedProduct.parts ?? []).length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600">Hammadde Seçimi</label>
                {(selectedProduct.parts as any[]).map((part: any) => {
                  const selectedMatId = partMaterials[part.id] ?? '';
                  const selectedMat = materials.find((m: any) => m.id === selectedMatId);
                  const stock = selectedMat?.stock ?? part.material?.stock ?? null;
                  return (
                    <div key={part.id} className="flex items-center gap-2">
                      <span className="w-24 flex-shrink-0 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1.5 rounded-lg text-center truncate">
                        {part.name}
                      </span>
                      <select
                        value={selectedMatId}
                        onChange={e => setPartMaterials(prev => ({ ...prev, [part.id]: e.target.value }))}
                        className="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">— Seç —</option>
                        {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <div className={`w-24 flex-shrink-0 px-2 py-1.5 border rounded-lg text-xs text-right ${
                        stock === null ? 'bg-slate-50 border-slate-200 text-slate-400' :
                        stock <= 0 ? 'bg-red-50 border-red-200 text-red-600 font-medium' :
                        'bg-green-50 border-green-200 text-green-700 font-medium'
                      }`}>
                        {stock !== null ? `${stock.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Numara Dağılımı */}
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">Numara Dağılımı *</h2>
              {totalQty > 0 && (
                <span className="text-sm font-bold text-blue-600">{totalQty} çift</span>
              )}
            </div>
            <SizeTable value={sizeDistribution} onChange={setSizeDistribution} sizes={selectedProduct?.sizes} />
          </div>

          {/* Diğer */}
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Diğer Bilgiler</h2>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">İstenen Termin</label>
              <input type="date" value={form.requestedDeliveryDate} onChange={e => setForm(f => ({ ...f, requestedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notlar</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>

          <button type="submit" disabled={saving || totalQty === 0 || !form.customerId}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Kaydediliyor...' : 'Siparişi Oluştur'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
