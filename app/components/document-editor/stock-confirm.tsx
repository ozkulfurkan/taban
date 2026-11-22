'use client';

import { X, Loader2, CheckCircle, AlertTriangle } from '@/app/components/icons';
import { fmtQty } from '@/lib/stock-display';
import { fromPriceInput } from '@/lib/price-input';
import type { DocLine } from '@/lib/document-lines';
import { useDocText } from './shared';

export type Deduction = { name: string; parts: string; kgAmount: number; currentStock: number };
export type Shortage = { name: string; unit: string; quantity: number; stock: number };

// Satışta düşülecek hammaddeleri ve yetersiz ürün stoğunu hesaplar.
export function stockImpact(lines: DocLine[], products: any[], materials: any[]) {
  const deductions = new Map<string, Deduction>();
  const qtyByProduct = new Map<string, number>();
  for (const l of lines) {
    if (!l.productId) continue;
    const qty = fromPriceInput(l.quantity);
    qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + qty);
    const product = products.find(p => p.id === l.productId);
    for (const part of product?.parts ?? []) {
      const matId = l.partVariantsData?.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
      if (!matId) continue;
      const kg = (part.gramsPerPiece * (1 + (part.wasteRate ?? 0) / 100) * qty) / 1000;
      const mat = materials.find(m => m.id === matId);
      const prev = deductions.get(matId);
      if (prev) { prev.kgAmount += kg; if (!prev.parts.includes(part.name)) prev.parts += `, ${part.name}`; }
      else deductions.set(matId, { name: mat?.name ?? part.material?.name ?? '—', parts: part.name, kgAmount: kg, currentStock: mat?.stock ?? part.material?.stock ?? 0 });
    }
  }
  const shortages: Shortage[] = [];
  for (const [id, quantity] of Array.from(qtyByProduct.entries())) {
    const p = products.find(x => x.id === id);
    if (p && quantity > (p.stock ?? 0)) shortages.push({ name: p.name, unit: p.unit ?? 'çift', quantity, stock: p.stock ?? 0 });
  }
  return { deductions: Array.from(deductions.values()), shortages };
}

export default function StockConfirm({ deductions, shortages, saving, onConfirm, onCancel }: {
  deductions: Deduction[]; shortages: Shortage[]; saving: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const tx = useDocText();
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col border border-ink-200/80">
        <div className="bg-brand-700 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold">{tx('stockConfirmTitle')}</h3>
          <button onClick={onCancel} aria-label={tx('close')} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {shortages.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {tx('stockShortage')}
              </p>
              <ul className="text-xs text-amber-900 space-y-0.5 pl-6">
                {shortages.map(s => (
                  <li key={s.name}>
                    <span className="font-medium">{s.name}</span>: {fmtQty(s.stock)} → <span className="font-semibold text-red-600">{fmtQty(s.stock - s.quantity)} {s.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {deductions.length > 0 && (
            <div>
              <p className="text-sm text-ink-600 mb-2">{tx('materialDeduction')}</p>
              <div className="border border-ink-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-ink-100">
                    {deductions.map(d => {
                      const short = d.currentStock < d.kgAmount;
                      return (
                        <tr key={d.name + d.parts} className={short ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-ink-700">{d.name}</p>
                            <p className="text-xs text-ink-400">{d.parts}</p>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600 whitespace-nowrap">−{fmtQty(d.kgAmount)} kg</td>
                          <td className={`px-3 py-2 text-right whitespace-nowrap ${short ? 'text-red-600 font-medium' : 'text-emerald-600'}`}>{fmtQty(d.currentStock)} kg</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">{tx('goBack')}</button>
          <button onClick={onConfirm} disabled={saving}
            className="flex-1 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {tx('confirmSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
