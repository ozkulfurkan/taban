'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import Link from 'next/link';
import { Calculator, Plus, Loader2, Trash2, ChevronRight } from 'lucide-react';

function rowCostTL(qty: number, price: number, currency: string, kurUsd: number, kurEur: number) {
  const m = currency === 'USD' ? kurUsd : currency === 'EUR' ? kurEur : 1;
  return qty * price * m;
}

function calcPerKg(calc: any): { perKgTL: number; perKgUSD: number } {
  const items: any[] = calc.items || [];
  const totalWeight = items.reduce((s: number, i: any) => s + (i.qty || 0), 0);
  const matCostExVat = items.reduce((s: number, i: any) =>
    s + rowCostTL(i.qty || 0, i.unitPriceExVat || 0, i.currency, calc.kurUsd, calc.kurEur), 0);
  const matCostInVat = matCostExVat * (1 + (calc.kdvRate || 0));
  const laborMult = calc.laborCur === 'USD' ? calc.kurUsd : calc.laborCur === 'EUR' ? calc.kurEur : 1;
  const laborTL = (calc.laborPerKg || 0) * totalWeight * laborMult;
  const perKgTL = totalWeight > 0 ? (matCostInVat + laborTL) / totalWeight : 0;
  const perKgUSD = calc.kurUsd > 0 ? perKgTL / calc.kurUsd : 0;
  return { perKgTL, perKgUSD };
}

export default function HesaplayiciPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const router = useRouter();
  const [calculations, setCalculations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.companyType !== 'MATERIAL_SUPPLIER') router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => {
    fetch('/api/hesaplayici')
      .then(r => r.json())
      .then(d => setCalculations(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" hesaplamayı silmek istediğinize emin misiniz?`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/hesaplayici/${id}`, { method: 'DELETE' });
      setCalculations(prev => prev.filter(c => c.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Hesaplayıcı</h1>
            <p className="text-slate-500 text-sm">{calculations.length} kayıtlı formül</p>
          </div>
          <Link
            href="/hesaplayici/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Yeni Hesaplama
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !calculations.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 mb-4">Henüz hesaplama yapılmamış</p>
            <Link href="/hesaplayici/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              İlk Hesaplamayı Oluştur
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_160px_160px_48px] items-center px-4 py-2.5 bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide">
              <span>Hesaplama Adı</span>
              <span className="text-right">kg Başına (TL)</span>
              <span className="text-right">kg Başına (USD)</span>
              <span />
            </div>
            <div className="divide-y divide-slate-100">
              {calculations.map(c => {
                const { perKgTL, perKgUSD } = calcPerKg(c);
                return (
                  <div key={c.id} className="grid grid-cols-[1fr_160px_160px_48px] items-center hover:bg-slate-50/80 transition-colors group">
                    <Link href={`/hesaplayici/${c.id}`} className="px-4 py-3 flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString('tr-TR')} · {c.items?.length || 0} bileşen
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 ml-auto" />
                    </Link>
                    <div className="text-right pr-4 py-3">
                      <span className="text-sm font-semibold text-slate-800">
                        {perKgTL.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    <div className="text-right pr-4 py-3">
                      <span className="text-sm font-semibold text-slate-600">
                        {perKgUSD.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} $
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deleting === c.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deleting === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
