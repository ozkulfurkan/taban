'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import SizeTable from '@/app/portal/components/size-table';
import { ChevronLeft, ChevronRight, Loader2, Factory, CheckCircle2 } from 'lucide-react';

const STEPS = ['Fasoncu & Ürün', 'Numara Dağılımı', 'BOM Önizleme', 'Termin & Notlar'];

export default function NewSubcontractorOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [form, setForm] = useState({
    subcontractorId: '',
    productId: '',
    sizeDistribution: {} as Record<string, number>,
    dueDate: '',
    notes: '',
  });

  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    fetch('/api/subcontractors').then(r => r.json()).then(d => { if (Array.isArray(d)) setSubcontractors(d); });
    fetch('/api/products').then(r => r.json()).then(d => { if (Array.isArray(d)) setProducts(d); });
  }, []);

  useEffect(() => {
    if (form.productId) {
      const p = products.find(p => p.id === form.productId);
      setSelectedProduct(p || null);
    } else {
      setSelectedProduct(null);
    }
  }, [form.productId, products]);

  const totalPairs = Object.values(form.sizeDistribution).reduce((s, v) => s + (Number(v) || 0), 0);

  // BOM hesabı (client-side)
  const bomReqs = selectedProduct?.parts?.map((part: any) => ({
    name: part.name,
    material: part.material?.name ?? '—',
    variant: part.materialVariant ? `${part.materialVariant.colorName}${part.materialVariant.code ? ` (${part.materialVariant.code})` : ''}` : null,
    kgRequired: Math.round((part.gramsPerPiece * (1 + part.wasteRate / 100) * totalPairs) / 1000 * 1000) / 1000,
  })) ?? [];

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/subcontractor-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontractorId: form.subcontractorId,
          productId: form.productId || null,
          sizeDistribution: form.sizeDistribution,
          dueDate: form.dueDate || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/subcontractor-orders/${data.id}`);
      }
    } finally { setSaving(false); }
  };

  const canNext = () => {
    if (step === 0) return !!form.subcontractorId;
    if (step === 1) return totalPairs > 0;
    return true;
  };

  return (
    <AppShell>
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-orange-600" />
            <h1 className="text-lg font-bold text-slate-800">Yeni Fason Sipariş</h1>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${i === step ? 'bg-orange-100 text-orange-700' : i < step ? 'text-green-600' : 'text-slate-400'}`}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">{i + 1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-300 mx-1" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {/* Step 0: Fasoncu & Ürün */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fasoncu *</label>
                <select value={form.subcontractorId} onChange={e => setForm(p => ({ ...p, subcontractorId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">— Fasoncu Seçin —</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ürün (opsiyonel)</label>
                <select value={form.productId} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">— Ürün Seçin —</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: Numara Dağılımı */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700">Numara Dağılımı</h3>
              <SizeTable value={form.sizeDistribution} onChange={v => setForm(p => ({ ...p, sizeDistribution: v }))} />
              <p className="text-sm text-slate-500">Toplam: <span className="font-bold text-slate-700">{totalPairs} çift</span></p>
            </div>
          )}

          {/* Step 2: BOM Önizleme */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700">Hammadde Gereksinimleri (BOM Önizleme)</h3>
              {bomReqs.length === 0 ? (
                <p className="text-slate-400 text-sm">Ürün seçilmedi veya BOM tanımlı değil</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500">
                    <th className="px-3 py-2 text-left">Parça</th>
                    <th className="px-3 py-2 text-left">Hammadde</th>
                    <th className="px-3 py-2 text-right">Gereken (kg)</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {bomReqs.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-700">{r.name}</td>
                        <td className="px-3 py-2 text-slate-600">{r.material}{r.variant ? <span className="text-slate-400 ml-1">({r.variant})</span> : ''}</td>
                        <td className="px-3 py-2 text-right font-semibold text-orange-600">{r.kgRequired.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-slate-400">* Fire payı dahil hesaplanmıştır</p>
            </div>
          )}

          {/* Step 3: Termin & Notlar */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Termin Tarihi</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notlar</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  placeholder="Özel talimatlar..." />
              </div>

              {/* Özet */}
              <div className="bg-orange-50 rounded-lg p-4 text-sm space-y-1">
                <p><span className="text-slate-500">Fasoncu:</span> <span className="font-medium">{subcontractors.find(s => s.id === form.subcontractorId)?.name}</span></p>
                <p><span className="text-slate-500">Ürün:</span> <span className="font-medium">{selectedProduct?.name || '—'}</span></p>
                <p><span className="text-slate-500">Toplam:</span> <span className="font-bold text-orange-700">{totalPairs} çift</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Önceki
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium disabled:opacity-40">
              Sonraki <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving || totalPairs === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Siparişi Oluştur
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
