'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { Plus, Loader2, ShoppingCart, Building2, Printer, Trash2, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Taslak',    color: 'bg-slate-100 text-slate-600' },
  PENDING:   { label: 'Bekliyor',  color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Kısmi',     color: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Ödendi',    color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'İptal',     color: 'bg-red-100 text-red-600' },
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'PARTIAL', 'PAID', 'DRAFT', 'CANCELLED'];

export default function PurchasesListPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/purchases')
      .then(r => r.json())
      .then(d => setPurchases(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const handleDelete = async (id: string, no: string) => {
    if (!confirm(`"${no || id}" silinsin mi?`)) return;
    await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    setPurchases(prev => prev.filter(p => p.id !== id));
  };

  const filtered = purchases.filter(p => {
    if (statusFilter !== 'ALL') {
      const remaining = p.total - p.paidAmount;
      const computedStatus = remaining <= 0 ? 'PAID' : remaining < p.total ? 'PARTIAL' : 'PENDING';
      if (computedStatus !== statusFilter && p.status !== statusFilter) return false;
    }
    if (search.length >= 3) {
      const q = search.toLowerCase();
      return (
        p.invoiceNo?.toLowerCase().includes(q) ||
        p.supplier?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Alışlar</h1>
            <p className="text-slate-500 text-sm">{purchases.length} alış faturası</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm text-slate-500 font-medium whitespace-nowrap">Ara:</span>
              <select className="text-sm text-slate-600 outline-none bg-transparent border-r border-slate-200 pr-2 mr-1">
                <option>Tedarikçi İsmi / Belge No</option>
              </select>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="arama... (en az 3)"
                className="text-sm outline-none w-40 placeholder:text-slate-300"
              />
            </div>
            <Link href="/purchases/new"
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm">
              <Plus className="w-4 h-4" /> Yeni Alış
            </Link>
          </div>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s === 'ALL' ? 'Tümü' : (STATUS_LABELS[s]?.label ?? s)}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {search.length >= 3 ? 'Arama sonucu bulunamadı' : 'Henüz alış faturası yok'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-left">Tedarikçi</th>
                  <th className="px-4 py-3 text-left">Belge No</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isOpen = expandedId === p.id;
                  return (
                    <>
                      {/* Main row */}
                      <tr
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 text-xs font-bold ${
                            isOpen ? 'border-slate-500 text-slate-600 bg-slate-100' : 'border-slate-400 text-slate-500'
                          }`}>
                            {isOpen ? '−' : '+'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          <div>{new Date(p.date).toLocaleDateString('tr-TR')}</div>
                          <div className="text-xs text-slate-400">{new Date(p.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{p.supplier?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.invoiceNo || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {p.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isOpen && (
                        <tr key={`${p.id}-expanded`} className="border-b border-slate-200 bg-slate-50">
                          <td colSpan={5} className="px-6 py-4">
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              <Link
                                href={`/purchases/${p.id}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" /> Alış ekranına git
                              </Link>
                              <Link
                                href={`/suppliers/${p.supplierId}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <Building2 className="w-3.5 h-3.5" /> Tedarikçi ekranına git
                              </Link>
                              <Link
                                href={`/purchases/${p.id}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" /> Yazdır
                              </Link>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(p.id, p.invoiceNo); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-500 border border-red-200 rounded-lg text-xs font-medium transition-colors ml-auto"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Sil
                              </button>
                            </div>

                            {/* Materials table */}
                            {p.purchaseMaterials && p.purchaseMaterials.length > 0 && (
                              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mb-3">
                                <thead>
                                  <tr className="bg-white border-b border-slate-200">
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Ürün/Hizmet</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Fiyat</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Tutar (KDV Dahil)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {p.purchaseMaterials.map((pm: any) => {
                                    const tutar = (pm.kgAmount ?? 0) * (pm.pricePerKg ?? 0);
                                    return (
                                      <tr key={pm.id}>
                                        <td className="px-4 py-2.5 text-slate-700">
                                          <span className="text-slate-400 mr-1">{pm.kgAmount} kg</span>
                                          {pm.material?.name}
                                          {pm.subcontractor && (
                                            <span className="ml-2 text-xs text-orange-600">→ {pm.subcontractor.name}</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-600">
                                          {pm.pricePerKg ? pm.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                                          {tutar > 0 ? tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}

                            {/* Ödeme özeti */}
                            <div className="flex gap-4 text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-4 py-2.5 inline-flex w-full max-w-xs">
                              <div>
                                <span className="text-slate-400">Ödenen:</span>{' '}
                                <span className="font-semibold text-teal-600">
                                  {p.paidAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Kalan:</span>{' '}
                                <span className={`font-semibold ${(p.total - p.paidAmount) > 0 ? 'text-red-500' : 'text-teal-600'}`}>
                                  {(p.total - p.paidAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
