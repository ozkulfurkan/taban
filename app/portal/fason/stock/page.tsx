'use client';

import { useEffect, useState } from 'react';
import { Loader2, Package } from 'lucide-react';

export default function FasonStockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/portal/fason/stock')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStocks(data); })
      .finally(() => setLoading(false));
  }, []);

  const totalKg = stocks.reduce((s, st) => s + (st.quantity || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Hammadde Stoğum</h1>
        <p className="text-slate-500 text-sm mt-0.5">Size zimmetlenen hammadde miktarları</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-orange-500" /></div>
      ) : stocks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Henüz zimmetli hammadde bulunmuyor.</p>
        </div>
      ) : (
        <>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-orange-700">Toplam Zimmet</p>
            <p className="text-lg font-bold text-orange-800">{totalKg.toFixed(2)} kg</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hammadde</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Renk / Varyant</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Miktar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {s.material?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.materialVariant ? (
                        <span className="inline-flex items-center gap-1.5">
                          {s.materialVariant.colorName}
                          {s.materialVariant.code && (
                            <span className="text-slate-400 text-xs">({s.materialVariant.code})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${s.quantity <= 0 ? 'text-slate-400' : 'text-slate-800'}`}>
                        {s.quantity.toFixed(2)}
                      </span>
                      <span className="text-slate-400 ml-1 text-xs">kg</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
