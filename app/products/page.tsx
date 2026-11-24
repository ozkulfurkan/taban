'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { BoxIcon, Plus, Trash2, Loader2, Search, Globe, X, Check, Upload, Download, Tag, Pencil, AlertTriangle, BookOpen } from '@/app/components/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { foldTr } from '@/lib/search';
import { stockTextClass, fmtQty } from '@/lib/stock-display';
import MoreMenu from '@/app/components/more-menu';
import { ProductThumb } from '@/app/components/product-image';

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Arama yazarken liste takılmasın: filtre ertelenmiş değerle çalışır; uzun listede ilk PAGE satır çizilir
  const deferredSearch = useDeferredValue(search);
  const PAGE = 200;
  const [limit, setLimit] = useState(PAGE);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  // Portal modal
  const [modal, setModal] = useState<PortalModalState | null>(null);
  const [portalCustomers, setPortalCustomers] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const loadProducts = () => {
    fetch('/api/products?list=1')
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadCategories = () => {
    fetch('/api/product-categories')
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(console.error);
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    setConfirmModal({ message: `"${name}" silinecek.`, onConfirm: async () => {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== id));
    }});
  };

  // Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/products/import', { method: 'POST', body: fd });
      const data = await res.json();
      setImportResult(data);
      loadProducts();
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    window.location.href = '/api/products/import';
  };

  // Categories
  const saveCategory = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      if (editingCat) {
        await fetch(`/api/product-categories/${editingCat.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCatName.trim() }),
        });
      } else {
        await fetch('/api/product-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCatName.trim() }),
        });
      }
      loadCategories();
      setNewCatName('');
      setEditingCat(null);
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const res = await fetch(`/api/product-categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setErrorMsg(data.error); return; }
    loadCategories();
    if (selectedCategory === id) setSelectedCategory(null);
  };

  // Portal modal
  const openPortalModal = async (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setModalLoading(true);
    setModal({ productId: product.id, productName: product.name, portalVisible: product.portalVisible, assignedCustomerIds: [] });
    try {
      const [vis, cust] = await Promise.all([
        fetch(`/api/products/${product.id}/portal-visibility`).then(r => r.json()),
        fetch('/api/portal/customers').then(r => r.json()),
      ]);
      setModal({ productId: product.id, productName: product.name, portalVisible: vis.portalVisible ?? false, assignedCustomerIds: vis.assignedCustomerIds ?? [] });
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
        body: JSON.stringify({ portalVisible: modal.portalVisible, assignedCustomerIds: modal.assignedCustomerIds }),
      });
      setProducts(prev => prev.map(p => p.id === modal.productId
        ? { ...p, portalVisible: modal.portalVisible, _count: { ...p._count, portalCustomers: modal.portalVisible ? modal.assignedCustomerIds.length : 0 } }
        : p
      ));
      setModal(null);
    } finally {
      setModalSaving(false);
    }
  };

  const getPortalBadge = (p: any) => {
    if (!p.portalVisible) return { label: 'Gizli', cls: 'bg-ink-100 text-ink-500' };
    const count = p._count?.portalCustomers ?? 0;
    if (count === 0) return { label: 'Tüm Müşteriler', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: `${count} Müşteri`, cls: 'bg-brand-100 text-brand-800' };
  };

  // Her ürün için aranabilir metin bir kez hesaplanır (Türkçe karakterden bağımsız)
  const index = useMemo(() => products.map(p => ({ p, code: foldTr(p.code), text: foldTr(`${p.name} ${p.code ?? ''} ${p.description ?? ''} ${p.category?.name ?? ''}`) })), [products]);
  const filtered = useMemo(() => {
    const q = foldTr(deferredSearch);
    const rows = index.filter(r => (!q || r.text.includes(q)) && (!selectedCategory || r.p.categoryId === selectedCategory));
    // Kod tam eşleşmesi (ör. 1017) en üstte, sonra kodu aramayla başlayanlar
    if (q) rows.sort((a, b) => (a.code === q ? 0 : a.code.startsWith(q) ? 1 : 2) - (b.code === q ? 0 : b.code.startsWith(q) ? 1 : 2));
    return rows.map(r => r.p);
  }, [index, deferredSearch, selectedCategory]);
  useEffect(() => { setLimit(PAGE); }, [deferredSearch, selectedCategory]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">{t('products', 'title')}</h1>
            <p className="text-ink-500 text-sm">{products.length} {t('products', 'title').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setCatModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-ink-200 bg-white hover:bg-ink-50 text-ink-600 rounded-lg text-sm font-medium transition-colors">
              <Tag className="w-4 h-4" /> Kategoriler
            </button>
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-ink-200 bg-white hover:bg-ink-50 text-ink-600 rounded-lg text-sm font-medium transition-colors">
              <Download className="w-4 h-4" /> Şablon
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'İçe Aktarılıyor...' : 'Excel\'den İçe Aktar'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Link href="/products/katalog" className="flex items-center gap-1.5 px-3 py-2 border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-sm font-medium transition-colors" data-testid="open-catalog">
              <BookOpen className="w-4 h-4" /> Katalog PDF
            </Link>
            <Link href="/products/new" className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium transition-colors shadow-sm text-sm">
              <Plus className="w-4 h-4" /> {t('products', 'newProduct')}
            </Link>
          </div>
        </div>

        {/* Import result */}
        {importResult && (
          <div className={`rounded-xl px-4 py-3 text-sm flex items-start justify-between gap-3 ${importResult.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
            <div>
              <span className="font-semibold">{importResult.created} eklendi, {importResult.updated} güncellendi, {importResult.skipped} atlandı.</span>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                  {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                  {importResult.errors.length > 5 && <li>...ve {importResult.errors.length - 5} hata daha</li>}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-ink-400 hover:text-ink-600 flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Category filter tabs */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!selectedCategory ? 'bg-brand-700 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}
            >
              Tümü
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategory === c.id ? 'bg-brand-700 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}
              >
                {c.name} <span className="opacity-60 text-xs">({c._count?.products ?? 0})</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products', 'searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 border border-ink-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-card border border-ink-200/80">
            <BoxIcon className="w-12 h-12 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-400 text-sm mb-3">{search ? t('products', 'noResults') : t('products', 'empty')}</p>
            {!search && (
              <Link href="\products\new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Ürün ekle
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{t('products', 'code')}</th>
                  <th className="px-4 py-3 text-left">{t('products', 'productName')}</th>
                  <th className="px-4 py-3 text-left">Kategori</th>
                  <th className="px-4 py-3 text-left">{t('products', 'unit')}</th>
                  <th className="px-4 py-3 text-right">{t('products', 'unitPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('products', 'stock')}</th>
                  <th className="px-4 py-3 text-center">Portal</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.slice(0, limit).map(p => {
                  const badge = getPortalBadge(p);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-brand-50/50 cursor-pointer"
                      onClick={() => router.push(`/products/${p.id}?edit=true`)}
                    >
                      <td className="px-4 py-3 text-ink-500">{p.code || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb productId={p.id} imageUpdatedAt={p.imageUpdatedAt} />
                          <div className="min-w-0">
                            <p className="font-medium text-ink-800">{p.name}</p>
                            {p.description && <p className="text-xs text-ink-400 mt-0.5">{p.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{p.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-700">
                        {p.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-ink-400 ml-1">{p.currency}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium tabular-nums ${stockTextClass(p.stock)}`}>
                          {fmtQty(p.stock)} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={e => openPortalModal(e, p)} className="inline-flex items-center gap-1.5 group" title="Portal görünürlüğünü yönet">
                          {badge ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls} group-hover:opacity-80`}>{badge.label}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ink-100 text-ink-400 group-hover:opacity-80">Gizli</span>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <MoreMenu size="sm" label="Ürün işlemleri" items={[
                          { label: 'Düzenle', icon: Pencil, onClick: () => router.push(`/products/${p.id}?edit=true`) },
                          { label: 'Sil', icon: Trash2, danger: true, onClick: () => handleDelete(p.id, p.name) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > limit && (
              <div className="flex items-center justify-center gap-3 py-3 border-t border-ink-100 text-sm">
                <span className="text-ink-500">{limit.toLocaleString('tr-TR')} / {filtered.length.toLocaleString('tr-TR')} ürün gösteriliyor</span>
                <button onClick={() => setLimit(l => l + PAGE * 5)} className="font-semibold text-brand-700 hover:text-brand-800" data-testid="products-more">Daha fazla göster</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Management Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setCatModalOpen(false); setEditingCat(null); setNewCatName(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-ink-200/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-ink-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-brand-700" />
                <h3 className="font-semibold text-ink-800">Kategori Yönetimi</h3>
              </div>
              <button onClick={() => { setCatModalOpen(false); setEditingCat(null); setNewCatName(''); }} className="p-1.5 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveCategory()}
                  placeholder={editingCat ? 'Yeni isim...' : 'Kategori adı...'}
                  className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                />
                <button onClick={saveCategory} disabled={catSaving || !newCatName.trim()} className="px-3 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                  {catSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingCat ? 'Güncelle' : 'Ekle'}
                </button>
                {editingCat && (
                  <button onClick={() => { setEditingCat(null); setNewCatName(''); }} className="px-3 py-2 border border-ink-200 rounded-lg text-sm text-ink-600 hover:bg-ink-50">İptal</button>
                )}
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {categories.length === 0 && <p className="text-sm text-ink-400 text-center py-4">Henüz kategori yok</p>}
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-ink-50">
                    <span className="text-sm text-ink-700">{c.name} <span className="text-ink-400 text-xs">({c._count?.products ?? 0} ürün)</span></span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingCat({ id: c.id, name: c.name }); setNewCatName(c.name); }} className="p-1.5 text-ink-400 hover:text-brand-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteCategory(c.id)} className="p-1.5 text-ink-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portal Visibility Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-ink-200/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-ink-100">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-brand-700" />
                <h3 className="font-semibold text-ink-800">Portal Görünürlüğü</h3>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100"><X className="w-4 h-4" /></button>
            </div>
            {modalLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand-700" /></div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm text-ink-500 font-medium truncate">{modal.productName}</p>
                <label className="flex items-center justify-between cursor-pointer p-3 bg-ink-50 rounded-xl">
                  <span className="text-sm font-medium text-ink-700">Portala Ekle</span>
                  <button type="button" role="switch" aria-checked={modal.portalVisible}
                    onClick={() => setModal(m => m ? ({ ...m, portalVisible: !m.portalVisible }) : null)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${modal.portalVisible ? 'bg-brand-700' : 'bg-ink-300'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${modal.portalVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
                {modal.portalVisible && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Müşteri Kısıtlaması</p>
                    <p className="text-xs text-ink-400">{modal.assignedCustomerIds.length === 0 ? 'Hiçbiri seçilmezse tüm portal müşterileri görebilir.' : `${modal.assignedCustomerIds.length} müşteri seçili — sadece onlar görebilir.`}</p>
                    {portalCustomers.length === 0 ? (
                      <p className="text-xs text-ink-400 italic py-2">Portal müşterisi henüz eklenmemiş.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {portalCustomers.map(pc => {
                          const checked = modal.assignedCustomerIds.includes(pc.id);
                          return (
                            <label key={pc.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-brand-50' : 'hover:bg-ink-50'}`}>
                              <div onClick={() => toggleCustomer(pc.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-brand-700 border-brand-700' : 'border-ink-300'}`}>
                                {checked && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0" onClick={() => toggleCustomer(pc.id)}>
                                <p className="text-sm font-medium text-ink-700 truncate">{pc.name || pc.email}</p>
                                <p className="text-xs text-ink-400 truncate">{pc.customer?.name}</p>
                              </div>
                              {!pc.isActive && <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">Pasif</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 border border-ink-200 rounded-lg text-sm font-medium text-ink-600 hover:bg-ink-50">İptal</button>
                  <button onClick={savePortalModal} disabled={modalSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                    {modalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Kaydet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-800 mb-1">Emin misiniz?</h3>
                <p className="text-sm text-ink-600 whitespace-pre-line">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-ink-50">İptal</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setErrorMsg('')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-ink-200/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-800 mb-1">Hata</h3>
                <p className="text-sm text-ink-600">{errorMsg}</p>
              </div>
            </div>
            <button onClick={() => setErrorMsg('')}
              className="w-full py-2 bg-ink-700 hover:bg-ink-800 text-white rounded-lg text-sm font-medium">
              Tamam
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
