'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { ArrowLeft, Loader2, Save, Plus, Trash2, Pencil, X, Package } from 'lucide-react';

const UNITS = ['çift', 'adet', 'kg', 'metre', 'paket'];
const CURRENCIES = ['USD', 'EUR', 'TRY'];

function emptyPart() {
  return { name: '', quantity: '1', gramsPerPiece: '', notes: '' };
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [editForm, setEditForm] = useState<any>({});
  const [editParts, setEditParts] = useState<any[]>([]);

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/products/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.error) {
          setProduct(d);
          setEditForm({
            name: d.name || '',
            code: d.code || '',
            description: d.description || '',
            unit: d.unit || 'çift',
            unitPrice: String(d.unitPrice ?? ''),
            currency: d.currency || 'USD',
            stock: String(d.stock ?? ''),
            notes: d.notes || '',
          });
          setEditParts((d.parts || []).map((p: any) => ({
            name: p.name,
            quantity: String(p.quantity),
            gramsPerPiece: String(p.gramsPerPiece),
            notes: p.notes || '',
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, parts: editParts }),
      });
      const updated = await res.json();
      if (!updated?.error) {
        setProduct(updated);
        setEditing(false);
      }
    } finally { setSaving(false); }
  };

  const addPart = () => setEditParts(p => [...p, emptyPart()]);
  const removePart = (i: number) => setEditParts(p => p.filter((_, idx) => idx !== i));
  const setPart = (i: number, f: string, v: string) =>
    setEditParts(p => p.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  if (loading) return (
    <AppShell>
      <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
    </AppShell>
  );
  if (!product) return (
    <AppShell>
      <div className="text-center py-16 text-slate-400">Ürün bulunamadı</div>
    </AppShell>
  );

  const parts: any[] = product.parts || [];
  const totalParts = parts.reduce((s: number, p: any) => s + p.quantity, 0);
  const totalGrams = parts.reduce((s: number, p: any) => s + p.quantity * p.gramsPerPiece, 0);

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium">
              <Pencil className="w-4 h-4" /> Düzenle
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
              </button>
              <button onClick={() => { setEditing(false); load(); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
                <X className="w-4 h-4" /> Vazgeç
              </button>
            </>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Product info */}
          <div className="space-y-3">
            {/* Product header */}
            <div className="bg-blue-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{product.name}</p>
                {product.code && <p className="text-blue-200 text-xs mt-0.5">Kod: {product.code}</p>}
              </div>
              <Package className="w-5 h-5 text-blue-300" />
            </div>

            {/* Product meta */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {editing && (
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">Düzenleme modu aktif</p>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Ürün Adı', field: 'name', type: 'text', value: product.name },
                  { label: 'Ürün Kodu', field: 'code', type: 'text', value: product.code || '—' },
                  { label: 'Birim', field: 'unit', type: 'select-unit', value: product.unit },
                  { label: 'Fiyat', field: 'unitPrice', type: 'number', value: `${Number(product.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${product.currency}` },
                  { label: 'Para Birimi', field: 'currency', type: 'select-currency', value: product.currency },
                  { label: 'Stok', field: 'stock', type: 'number', value: `${product.stock} ${product.unit}` },
                ].map(row => (
                  <div key={row.field} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    {editing ? (
                      row.type === 'select-unit' ? (
                        <select value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      ) : row.type === 'select-currency' ? (
                        <select value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input type={row.type === 'number' ? 'number' : 'text'} step="0.0001"
                          value={editForm[row.field] || ''}
                          onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                      )
                    ) : (
                      <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                    )}
                  </div>
                ))}
                {/* Description */}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Açıklama</span>
                  {editing ? (
                    <textarea value={editForm.description || ''} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  ) : (
                    <p className="text-sm text-slate-600">{product.description || <span className="text-slate-300 italic">—</span>}</p>
                  )}
                </div>
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Notlar</span>
                  {editing ? (
                    <textarea value={editForm.notes || ''} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  ) : (
                    <p className="text-sm text-slate-600">{product.notes || <span className="text-slate-300 italic">—</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary card */}
            {parts.length > 0 && !editing && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Parça Özeti</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Toplam Parça Çeşidi</span>
                  <span className="font-semibold text-slate-700">{parts.length} çeşit</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Toplam Adet</span>
                  <span className="font-semibold text-slate-700">{totalParts.toLocaleString('tr-TR')} adet</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span className="text-slate-600">Toplam Ağırlık</span>
                  <span className="text-blue-700">{totalGrams.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} gr</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Parts table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Parça / Hammadde Listesi</h2>
                {editing && (
                  <button onClick={addPart}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" /> Parça Ekle
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-blue-50 text-xs font-semibold text-slate-600 border-b border-blue-100">
                      <th className="px-3 py-2.5 text-left w-8">#</th>
                      <th className="px-3 py-2.5 text-left">Parça Adı</th>
                      <th className="px-3 py-2.5 text-right">Adet</th>
                      <th className="px-3 py-2.5 text-right">Gram / Adet</th>
                      <th className="px-3 py-2.5 text-right">Toplam Gram</th>
                      {editing && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {editing ? (
                      editParts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                            Henüz parça eklenmedi. "Parça Ekle" butonuna tıklayın.
                          </td>
                        </tr>
                      ) : editParts.map((part, idx) => {
                        const qty = parseFloat(part.quantity) || 0;
                        const gramsEach = parseFloat(part.gramsPerPiece) || 0;
                        const total = qty * gramsEach;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <input value={part.name} onChange={e => setPart(idx, 'name', e.target.value)}
                                placeholder="Parça adı"
                                className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="1" min="0" value={part.quantity}
                                onChange={e => setPart(idx, 'quantity', e.target.value)}
                                className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" min="0" value={part.gramsPerPiece}
                                onChange={e => setPart(idx, 'gramsPerPiece', e.target.value)}
                                placeholder="0"
                                className="w-24 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 font-medium">
                              {total > 0 ? total.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => removePart(idx)} className="p-1 text-red-400 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      parts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                            <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            Henüz parça eklenmemiş. Düzenle butonuna tıklayarak parça ekleyebilirsiniz.
                          </td>
                        </tr>
                      ) : parts.map((part: any, idx: number) => {
                        const total = part.quantity * part.gramsPerPiece;
                        return (
                          <tr key={part.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5 text-slate-700 font-medium">{part.name}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{part.quantity.toLocaleString('tr-TR')}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{part.gramsPerPiece.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} gr</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-blue-700">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} gr</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Totals footer */}
                  {!editing && parts.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                        <td colSpan={2} className="px-3 py-2.5 text-blue-800 text-sm">TOPLAM</td>
                        <td className="px-3 py-2.5 text-right text-blue-800">{totalParts.toLocaleString('tr-TR')} adet</td>
                        <td className="px-3 py-2.5 text-right text-blue-500 text-xs font-normal">—</td>
                        <td className="px-3 py-2.5 text-right text-blue-800">{totalGrams.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} gr</td>
                      </tr>
                    </tfoot>
                  )}
                  {editing && editParts.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                        <td colSpan={2} className="px-3 py-2.5 text-blue-800 text-sm">TOPLAM</td>
                        <td className="px-3 py-2.5 text-right text-blue-800">
                          {editParts.reduce((s, p) => s + (parseFloat(p.quantity) || 0), 0).toLocaleString('tr-TR')} adet
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-500 text-xs font-normal">—</td>
                        <td className="px-3 py-2.5 text-right text-blue-800">
                          {editParts.reduce((s, p) => s + (parseFloat(p.quantity) || 0) * (parseFloat(p.gramsPerPiece) || 0), 0)
                            .toLocaleString('tr-TR', { minimumFractionDigits: 2 })} gr
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
