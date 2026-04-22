'use client';

import { useState, useCallback, useEffect, useId } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { Plus, Trash2, Loader2, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';

type Item = { name: string; qty: number; currency: string; unitPriceExVat: number; unitPriceInVat: number };

function rowCostTL(qty: number, price: number, currency: string, kurUsd: number, kurEur: number) {
  const m = currency === 'USD' ? kurUsd : currency === 'EUR' ? kurEur : 1;
  return qty * price * m;
}

function calcResults(items: Item[], kurUsd: number, kurEur: number, kdvRate: number, laborPerKg: number, laborCur: string) {
  const totalWeight = items.reduce((s, i) => s + (i.qty || 0), 0);
  const matCostExVat = items.reduce((s, i) => s + rowCostTL(i.qty || 0, i.unitPriceExVat || 0, i.currency, kurUsd, kurEur), 0);
  const kdvAmount = matCostExVat * kdvRate;
  const matCostInVat = matCostExVat + kdvAmount;
  const laborMult = laborCur === 'USD' ? kurUsd : laborCur === 'EUR' ? kurEur : 1;
  const laborTL = (laborPerKg || 0) * totalWeight * laborMult;
  const perKgTL = totalWeight > 0 ? (matCostInVat + laborTL) / totalWeight : 0;
  const perKgUSD = kurUsd > 0 ? perKgTL / kurUsd : 0;
  return { totalWeight, matCostExVat, kdvAmount, matCostInVat, laborTL, perKgTL, perKgUSD };
}

const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt4 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function HesaplayiciDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const uid = useId();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [kurUsd, setKurUsd] = useState(0);
  const [kurEur, setKurEur] = useState(0);
  const [kdvRate, setKdvRate] = useState(0.20);
  const [laborPerKg, setLaborPerKg] = useState(0);
  const [laborCur, setLaborCur] = useState('TRY');
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/hesaplayici/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.replace('/hesaplayici'); return; }
        setName(d.name || '');
        setNotes(d.notes || '');
        setKurUsd(d.kurUsd || 0);
        setKurEur(d.kurEur || 0);
        setKdvRate(d.kdvRate ?? 0.20);
        setLaborPerKg(d.laborPerKg || 0);
        setLaborCur(d.laborCur || 'TRY');
        setItems((d.items || []).map((i: any) => ({
          name: i.name,
          qty: i.qty,
          currency: i.currency,
          unitPriceExVat: i.unitPriceExVat,
          unitPriceInVat: i.unitPriceExVat * (1 + (d.kdvRate ?? 0.20)),
        })));
      })
      .catch(() => router.replace('/hesaplayici'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const updateItem = useCallback((idx: number, field: keyof Item, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[idx] };
      if (field === 'unitPriceExVat') {
        item.unitPriceExVat = Number(value);
        item.unitPriceInVat = Number(value) * (1 + kdvRate);
      } else if (field === 'unitPriceInVat') {
        item.unitPriceInVat = Number(value);
        item.unitPriceExVat = Number(value) / (1 + kdvRate);
      } else {
        (item as any)[field] = typeof value === 'string' ? (field === 'name' || field === 'currency' ? value : Number(value)) : value;
      }
      next[idx] = item;
      return next;
    });
  }, [kdvRate]);

  const addItem = () => setItems(prev => [...prev, { name: '', qty: 0, currency: 'TRY', unitPriceExVat: 0, unitPriceInVat: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleKdvChange = (rate: number) => {
    setKdvRate(rate);
    setItems(prev => prev.map(item => ({ ...item, unitPriceInVat: item.unitPriceExVat * (1 + rate) })));
  };

  const results = calcResults(items, kurUsd, kurEur, kdvRate, laborPerKg, laborCur);

  const handleSave = async () => {
    if (!name.trim()) { setError('Hesaplama adı zorunludur'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/hesaplayici/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, notes, kurUsd, kurEur, kdvRate, laborPerKg, laborCur, items }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Kayıt hatası'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${name}" hesaplamayı silmek istediğinize emin misiniz?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/hesaplayici/${id}`, { method: 'DELETE' });
      router.push('/hesaplayici');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <AppShell><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/hesaplayici" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{name || 'Hesaplama'}</h1>
              <p className="text-slate-500 text-sm">Hammadde maliyet hesabı</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Sil
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saved ? 'Kaydedildi' : 'Kaydet'}
            </button>
          </div>
        </div>

        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Değişiklikler kaydedildi.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Genel Ayarlar */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Genel Ayarlar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Hesaplama Adı *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">USD Kuru (₺)</label>
              <input
                type="number" min="0" step="0.01"
                value={kurUsd || ''}
                onChange={e => setKurUsd(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">EUR Kuru (₺)</label>
              <input
                type="number" min="0" step="0.01"
                value={kurEur || ''}
                onChange={e => setKurEur(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">KDV Oranı</label>
              <select
                value={kdvRate}
                onChange={e => handleKdvChange(parseFloat(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value={0.08}>%8</option>
                <option value={0.10}>%10</option>
                <option value={0.18}>%18</option>
                <option value={0.20}>%20</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notlar</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="İsteğe bağlı"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Hammadde Tablosu */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Hammadde Bileşenleri</h2>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Satır Ekle
            </button>
          </div>

          <div className="hidden sm:grid grid-cols-[2fr_100px_90px_130px_130px_40px] gap-2 px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
            <span>Malzeme Adı</span>
            <span>Miktar (kg)</span>
            <span>Döviz</span>
            <span>KDV Hariç (₺/kg)</span>
            <span>KDV Dahil (₺/kg)</span>
            <span />
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div key={`${uid}-${idx}`} className="grid grid-cols-[2fr_100px_90px_130px_130px_40px] gap-2 items-center px-4 py-2">
                <input
                  value={item.name}
                  onChange={e => updateItem(idx, 'name', e.target.value)}
                  placeholder="Malzeme adı"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full"
                />
                <input
                  type="number" min="0" step="0.001"
                  value={item.qty || ''}
                  onChange={e => updateItem(idx, 'qty', e.target.value)}
                  placeholder="0"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full text-right"
                />
                <select
                  value={item.currency}
                  onChange={e => updateItem(idx, 'currency', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-full"
                >
                  <option value="TRY">TL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number" min="0" step="0.0001"
                  value={item.unitPriceExVat || ''}
                  onChange={e => updateItem(idx, 'unitPriceExVat', e.target.value)}
                  placeholder="0.00"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full text-right"
                />
                <input
                  type="number" min="0" step="0.0001"
                  value={item.unitPriceInVat || ''}
                  onChange={e => updateItem(idx, 'unitPriceInVat', e.target.value)}
                  placeholder="0.00"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full text-right"
                />
                <button
                  onClick={() => removeItem(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors mx-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* İşçilik */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">İşçilik</h2>
          <div className="flex items-center gap-3 max-w-sm">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">kg Başına İşçilik</label>
              <input
                type="number" min="0" step="0.01"
                value={laborPerKg || ''}
                onChange={e => setLaborPerKg(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-600 mb-1">Döviz</label>
              <select
                value={laborCur}
                onChange={e => setLaborCur(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="TRY">TL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sonuçlar */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-sm p-5 text-white space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide opacity-80">Hesap Sonuçları</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ResultCard label="Toplam Ağırlık" value={`${fmt2(results.totalWeight)} kg`} />
            <ResultCard label="Malzeme (KDV Hariç)" value={`${fmt2(results.matCostExVat)} ₺`} />
            <ResultCard label="KDV Tutarı" value={`${fmt2(results.kdvAmount)} ₺`} />
            <ResultCard label="Malzeme (KDV Dahil)" value={`${fmt2(results.matCostInVat)} ₺`} />
            <ResultCard label="Toplam İşçilik" value={`${fmt2(results.laborTL)} ₺`} />
          </div>
          <div className="border-t border-white/20 pt-3 grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-xl p-4 text-center">
              <p className="text-xs opacity-75 mb-1">kg Başına Maliyet (TL)</p>
              <p className="text-2xl font-bold">{fmt2(results.perKgTL)} ₺</p>
            </div>
            <div className="bg-white/15 rounded-xl p-4 text-center">
              <p className="text-xs opacity-75 mb-1">kg Başına Maliyet (USD)</p>
              <p className="text-2xl font-bold">{fmt4(results.perKgUSD)} $</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between pb-4">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Hesaplamayı Sil
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Kaydedildi' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-lg px-3 py-2">
      <p className="text-xs opacity-70 mb-0.5">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
