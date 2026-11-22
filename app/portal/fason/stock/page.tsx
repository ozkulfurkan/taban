'use client';

import { useEffect, useState } from 'react';
import { Loader2, Package, TrendingUp, TrendingDown, RotateCcw, Factory, Layers } from '@/app/components/icons';

function typeBadge(type: string, kgAmount: number) {
  if (type === 'gelen') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
        <TrendingUp className="w-3 h-3" /> Gelen Hammadde
      </span>
    );
  }
  if (type === 'iade') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
        <RotateCcw className="w-3 h-3" /> İade / Geri Gönderim
      </span>
    );
  }
  if (type === 'artirma') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
        <TrendingUp className="w-3 h-3" /> Artırma
      </span>
    );
  }
  if (type === 'azaltma') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
        <TrendingDown className="w-3 h-3" /> Azaltma
      </span>
    );
  }
  if (type === 'stok_guncelleme') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-800 rounded-full text-xs font-semibold">
        <Layers className="w-3 h-3" /> Stok Güncelleme
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink-100 text-ink-600 rounded-full text-xs font-semibold">
      <Factory className="w-3 h-3" /> {type}
    </span>
  );
}

export default function FasonStockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ekstreLoading, setEkstreLoading] = useState(true);

  useEffect(() => {
    fetch('/api/portal/fason/stock')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStocks(data); })
      .finally(() => setLoading(false));

    fetch('/api/portal/fason/ekstre')
      .then(r => r.json())
      .then(data => { if (data.entries) setEntries(data.entries); })
      .finally(() => setEkstreLoading(false));
  }, []);

  const totalKg = stocks.reduce((s, st) => s + (st.quantity || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Hammadde Stoğum</h1>
        <p className="text-ink-500 text-sm mt-0.5">Size zimmetlenen hammadde miktarları ve hareketler</p>
      </div>

      {/* Anlık Stok Özeti */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
      ) : stocks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center border border-ink-200/80">
          <Package className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-ink-400 text-sm">Henüz zimmetli hammadde bulunmuyor.</p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-amber-700">Toplam Zimmet</p>
            <p className="text-lg font-bold text-amber-800">{totalKg.toFixed(2)} kg</p>
          </div>

          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-ink-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Hammadde</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Miktar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stocks.map((s: any) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-800">
                      {s.material?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${s.quantity <= 0 ? 'text-ink-400' : 'text-ink-800'}`}>
                        {s.quantity.toFixed(2)}
                      </span>
                      <span className="text-ink-400 ml-1 text-xs">kg</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Stok Hareketleri */}
      <div>
        <h2 className="text-base font-semibold text-ink-700 mb-3">Stok Hareketleri</h2>
        {ekstreLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card p-8 text-center border border-ink-200/80">
            <p className="text-ink-400 text-sm">Henüz kayıtlı hareket bulunmuyor.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-ink-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Tarih</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Hammadde</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">İşlem</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Miktar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {entries.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-800">
                      {entry.materialName}
                    </td>
                    <td className="px-4 py-3">
                      {typeBadge(entry.type, entry.kgAmount)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${entry.kgAmount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {entry.kgAmount > 0 ? '+' : '−'}{Math.abs(entry.kgAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
