'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Link2, Loader2, Plus } from '@/app/components/icons';

// "Tabanlarım" (firma ağı siparişi, alıcı): kendi taban modelleri ve reçetedeki hammaddelerin bu tedarikçideki karşılığı.
// Eşleşmiş hammadde → "Sepete ekle" (ürün formu açılır, miktarı kullanıcı girer); eşleşmemiş → öneri ya da listeden eşleştir.

type Brief = { productId: string; code: string | null; name: string; unit: string | null };
type SolePart = {
  id: string; name: string; gramsPerPiece: number; wasteRate: number;
  material: { id: string; name: string } | null; match: Brief | null; suggestion: Brief | null;
};
type Sole = { id: string; code: string | null; name: string; parts: SolePart[] };
type CatalogItem = { id: string; code: string | null; name: string };

export default function SolesPanel({ solesUrl, mapUrl, products, onAdd }: {
  solesUrl: string; mapUrl: string; products: CatalogItem[]; onAdd: (productId: string) => void;
}) {
  const [soles, setSoles] = useState<Sole[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // eşleştirilen parça
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    fetch(solesUrl).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Tabanlar yüklenemedi');
      setSoles(d.soles ?? []);
    }).catch(e => setError(e.message));
  }, [solesUrl]);
  useEffect(load, [load]);

  const save = async (part: SolePart, sellerProductId: string | null) => {
    if (!part.material) return;
    setBusy(true);
    try {
      const r = await fetch(mapUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materialId: part.material.id, sellerProductId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error || 'Eşleştirilemedi'); return; }
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="bg-white rounded-xl p-8 text-center text-red-600 shadow-card border border-ink-200/80">{error}</div>;
  if (!soles) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  const q = search.trim().toLocaleLowerCase('tr');
  const list = soles.filter(s => !q || `${s.code ?? ''} ${s.name} ${s.parts.map(p => p.material?.name ?? '').join(' ')}`.toLocaleLowerCase('tr').includes(q));
  const label = (b: Brief | CatalogItem) => `${b.code ? `${b.code} · ` : ''}${b.name}`;

  return (
    <div className="space-y-3" data-testid="soles-panel">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Taban ya da hammadde ara"
          className="flex-1 min-w-[220px] px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none" />
        <p className="text-xs text-ink-500">Tabanınızı açın; reçetedeki hammaddelerin bu tedarikçideki karşılığını sepete ekleyin.</p>
      </div>
      {list.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-ink-500 text-sm shadow-card border border-ink-200/80">
          {q ? 'Aramaya uyan taban yok.' : 'Hammadde reçetesi tanımlı tabanınız yok. Ürün sayfasında parçalara hammadde ekleyin.'}
        </div>
      ) : list.map(s => {
        const isOpen = open === s.id;
        const matched = s.parts.filter(p => p.match).length;
        return (
          <div key={s.id} className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80" data-testid={`sole-${s.id}`}>
            <button type="button" onClick={() => setOpen(o => (o === s.id ? null : s.id))} aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-ink-50">
              <span>
                <span className="font-semibold text-ink-800">{label(s)}</span>
                <span className="block text-xs text-ink-500">{s.parts.length} hammadde · {matched} eşleşmiş</span>
              </span>
              {isOpen ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
            </button>
            {isOpen && (
              <div className="divide-y divide-ink-100 border-t border-ink-100">
                {s.parts.map(part => (
                  <div key={part.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm" data-testid={`sole-part-${part.id}`}>
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium text-ink-800">{part.material?.name ?? part.name}</p>
                      <p className="text-xs text-ink-500">{part.name} · {part.gramsPerPiece} g{part.wasteRate ? ` · fire %${part.wasteRate}` : ''}</p>
                      {part.match ? <p className="text-xs text-emerald-700 mt-0.5">→ {label(part.match)}</p>
                        : part.suggestion ? <p className="text-xs text-amber-700 mt-0.5">Öneri: {label(part.suggestion)}</p>
                        : <p className="text-xs text-ink-400 mt-0.5">Tedarikçide karşılığı seçilmedi</p>}
                    </div>
                    {editing === part.id ? (
                      <div className="flex items-center gap-2">
                        <select value={choice} onChange={e => setChoice(e.target.value)} className="px-2 py-1.5 border border-ink-200 rounded-lg text-sm max-w-[260px]">
                          <option value="">— Eşleşme yok —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
                        </select>
                        <button type="button" disabled={busy} onClick={() => save(part, choice || null)}
                          className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50">Kaydet</button>
                        <button type="button" onClick={() => setEditing(null)} className="text-xs text-ink-500 hover:text-ink-700">Vazgeç</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {part.match ? (
                          <button type="button" onClick={() => onAdd(part.match!.productId)} data-testid={`sole-add-${part.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold">
                            <Plus className="w-3.5 h-3.5" /> Sepete ekle
                          </button>
                        ) : part.suggestion ? (
                          <button type="button" disabled={busy} onClick={() => save(part, part.suggestion!.productId)} data-testid={`sole-accept-${part.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg text-xs font-semibold disabled:opacity-50">
                            <Link2 className="w-3.5 h-3.5" /> Eşleştir
                          </button>
                        ) : null}
                        <button type="button" onClick={() => { setEditing(part.id); setChoice(part.match?.productId ?? part.suggestion?.productId ?? ''); }}
                          className="text-xs text-brand-700 hover:underline">{part.match ? 'Değiştir' : part.suggestion ? 'Başka ürün' : 'Eşleştir'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
