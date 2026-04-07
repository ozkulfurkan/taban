'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { BoxIcon, Plus, Trash2, Loader2, Search, Globe, X, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface PortalModalState {
  productId: string;
  productName: string;
  portalVisible: boolean;
  assignedCustomerIds: string[];
}

export default function ProductsPage() {
  const { t, formatCurrency } = useLanguage();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Portal modal
  const [modal, setModal] = useState<PortalModalState | null>(null);
  const [portalCustomers, setPortalCustomers] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" ${t('common', 'delete')}?`)) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const openPortalModal = async (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setModalLoading(true);
    setModal({
      productId: product.id,
      productName: product.name,
      portalVisible: product.portalVisible,
      assignedCustomerIds: [],
    });
    try {
      const [vis, cust] = await Promise.all([
        fetch(`/api/products/${product.id}/portal-visibility`).then(r => r.json()),
        fetch('/api/portal/customers').then(r => r.json()),
      ]);
      setModal({
        productId: product.id,
        productName: product.name,
        portalVisible: vis.portalVisible ?? false,
        assignedCustomerIds: vis.assignedCustomerIds ?? [],
      });
      setPortalCustomers(Array.isArray(cust) ? cust : []);
    } finally {
      setModalLoading(false);
    }
  };

  const toggleCustomer = (id: string) => {
    if (!modal) return;
    setModal(m => m ? ({
      ...m,
      assignedCustomerIds: m.assignedCustomerIds.includes(id)
        ? m.assignedCustomerIds.filter(x => x !== id)
        : [...m.assignedCustomerIds, id],
    }) : null);
  };

  const savePortalModal = async () => {
    if (!modal) return;
    setModalSaving(true);
    try {
      await fetch(`/api/products/${modal.productId}/portal-visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalVisible: modal.portalVisible,
          assignedCustomerIds: modal.assignedCustomerIds,
        }),
      });
      setProducts(prev => prev.map(p => p.id === modal.productId
        ? {
            ...p,
            portalVisible: modal.portalVisible,
            _count: { ...p._count, portalCustomers: modal.portalVisible ? modal.assignedCustomerIds.length : 0 },
          }
        : p
      ));
      setModal(null);
    } finally {
      setModalSaving(false);
    }
  };

  const getPortalBadge = (p: any) => {
    if (!p.portalVisible) return null;
    const count = p._count?.portalCustomers ?? 0;
    if (count === 0) return { label: 'Herkese Açık', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: `Seçili: ${count}`, cls: 'bg-blue-100 text-blue-700' };
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('products', 'title')}</h1>
            <p className="text-slate-500 text-sm">{products.length} {t('products', 'title').toLowerCase()}</p>
          </div>
          <Link href="/products/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> {t('products', 'newProduct')}
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <BoxIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">{search ? t('products', 'noResults') : t('products', 'empty')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{t('products', 'productName')}</th>
                  <th className="px-4 py-3 text-left">{t('products', 'code')}</th>
                  <th className="px-4 py-3 text-left">{t('products', 'unit')}</th>
                  <th className="px-4 py-3 text-right">{t('products', 'unitPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('products', 'stock')}</th>
                  <th className="px-4 py-3 text-center">Portal</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p, i) => {
                  const badge = getPortalBadge(p);
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-blue-50/50 cursor-pointer"
                      onClick={() => router.push(`/products/${p.id}?edit=true`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.code || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        {p.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-400 ml-1">{p.currency}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${p.stock <= 0 ? 'text-red-500' : 'text-slate-700'}`}>
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => openPortalModal(e, p)}
                          className="inline-flex items-center gap-1.5 group"
                          title="Portal görünürlüğünü yönet"
                        >
                          {badge ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls} group-hover:opacity-80 transition-opacity`}>
                              {badge.label}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 group-hover:opacity-80 transition-opacity">
                              Gizli
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Portal Visibility Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Portal Görünürlüğü</h3>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-500 font-medium truncate">{modal.productName}</p>

                {/* Toggle */}
                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-medium text-slate-700">Portala Ekle</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={modal.portalVisible}
                    onClick={() => setModal(m => m ? ({ ...m, portalVisible: !m.portalVisible }) : null)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      modal.portalVisible ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      modal.portalVisible ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </label>

                {/* Per-customer assignment */}
                {modal.portalVisible && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Müşteri Kısıtlaması</p>
                    <p className="text-xs text-slate-400">
                      {modal.assignedCustomerIds.length === 0
                        ? 'Hiçbiri seçilmezse tüm portal müşterileri görebilir.'
                        : `${modal.assignedCustomerIds.length} müşteri seçili — sadece onlar görebilir.`}
                    </p>
                    {portalCustomers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">Portal müşterisi henüz eklenmemiş.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {portalCustomers.map(pc => {
                          const checked = modal.assignedCustomerIds.includes(pc.id);
                          return (
                            <label
                              key={pc.id}
                              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                                checked ? 'bg-blue-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div
                                onClick={() => toggleCustomer(pc.id)}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                }`}
                              >
                                {checked && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0" onClick={() => toggleCustomer(pc.id)}>
                                <p className="text-sm font-medium text-slate-700 truncate">{pc.name || pc.email}</p>
                                <p className="text-xs text-slate-400 truncate">{pc.customer?.name}</p>
                              </div>
                              {!pc.isActive && (
                                <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">Pasif</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setModal(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    İptal
                  </button>
                  <button onClick={savePortalModal} disabled={modalSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
                    {modalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Kaydet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
