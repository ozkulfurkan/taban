'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import { formatDate, toDateInputValue } from '@/lib/time';
import { postPayment } from '@/lib/post-payment';
import { parseAmount } from '@/lib/money';
import BackLink from '@/app/components/back-link';
import { Loader2, Printer, Pencil, X, Building2, Factory, AlertTriangle } from '@/app/components/icons';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;

const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı', 'POS'];

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const [payForm, setPayForm] = useState({
    amount: '', method: 'Nakit', date: toDateInputValue(), notes: '',
  });

  // Hammadde girişleri
  const [purchaseMaterials, setPurchaseMaterials] = useState<any[]>([]);


  const loadPurchaseMaterials = useCallback(() => {
    if (!params?.id) return;
    fetch(`/api/purchases/${params.id}/hammaddeler`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPurchaseMaterials(d); });
  }, [params?.id]);

  useEffect(() => {
    loadPurchaseMaterials();
  }, [loadPurchaseMaterials]);

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/purchases/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.error) {
          setPurchase(d);
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    setConfirmModal({ message: purchase.isReturn
      ? 'Bu iade silinecek.\n\n⚠️ İade edilen hammadde ve ürünler stoğa geri eklenecek, tedarikçi borcu iade tutarı kadar artacak.'
      : 'Bu alış faturası silinecek. Bağlı ödemeler de silinir.\n\n⚠️ Bu alışla eklenen hammadde ve ürün stokları geri alınacaktır.', onConfirm: async () => {
      setDeleting(true);
      await fetch(`/api/purchases/${params.id}`, { method: 'DELETE' });
      router.replace(`/suppliers/${purchase.supplierId}`);
    }});
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.amount || !(parseAmount(payForm.amount) > 0)) return;
    setPayLoading(true);
    try {
      const result = await postPayment({
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        amount: payForm.amount,
        currency: purchase.currency,
        date: payForm.date,
        method: payForm.method,
        notes: payForm.notes,
      });
      if (!result.ok) {
        if (result.error) window.alert(result.error);
        return;
      }
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'Nakit', date: toDateInputValue(), notes: '' });
      load();
    } finally { setPayLoading(false); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-700" /></div></AppShell>;
  if (!purchase) return <AppShell><div className="text-center py-16 text-ink-400">Alış faturası bulunamadı</div></AppShell>;

  const remaining = purchase.total - purchase.paidAmount;

  const totalKg = purchaseMaterials.reduce((s: number, pm: any) => s + (pm.kgAmount ?? 0), 0);
  const statusLabel = purchase.isReturn ? 'Alış İadesi' : remaining <= 0 ? 'Faturalaşmış' : remaining < purchase.total ? 'Kısmi Ödeme' : 'Beklemede';
  const statusColor = purchase.isReturn ? 'bg-amber-100 text-amber-700' : remaining <= 0 ? 'bg-emerald-100 text-emerald-700' : remaining < purchase.total ? 'bg-yellow-100 text-yellow-700' : 'bg-amber-100 text-amber-700';

  return (
    <AppShell>
      <div className="space-y-3 max-w-6xl">

        <BackLink href={`/suppliers/${purchase.supplierId}`} prefix="Tedarikçi" label={purchase.supplier?.name ?? ''} />

        {purchase.isReturn && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm font-medium">
            Tedarikçiye iade — bu belge stoğu düşürür ve tedarikçi borcunu azaltır.
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => handlePdf(purchase)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Yazdır
          </button>
          <Link href={`/purchases/${purchase.id}/edit`}
            className="flex items-center gap-2 px-3 py-1.5 bg-ink-700 hover:bg-ink-800 text-white rounded-lg text-sm font-medium">
            <Pencil className="w-4 h-4" /> Düzenle
          </Link>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} İptal Et
          </button>
          <Link href={`/suppliers/${purchase.supplierId}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium">
            <Building2 className="w-4 h-4" /> Tedarikçi Sayfası
          </Link>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">

          {/* LEFT: Supplier info panel */}
          <div className="space-y-3">
            {/* Supplier header */}
            <div className="bg-brand-800 rounded-xl px-4 py-4">
              <p className="text-white font-bold text-base">{purchase.supplier?.name}</p>
              {purchase.supplier?.taxId && <p className="text-brand-200 text-xs mt-0.5">VKN: {purchase.supplier.taxId}</p>}
            </div>

            {/* Meta fields */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
              <div className="divide-y divide-ink-100">
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs font-semibold text-ink-400 w-20 flex-shrink-0">Belge No</span>
                  <span className="text-sm text-ink-700 font-medium">{purchase.invoiceNo || <span className="text-ink-300 italic">—</span>}</span>
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs font-semibold text-ink-400 w-20 flex-shrink-0">Tarihi</span>
                  <span className="text-sm text-ink-700 font-medium">{fmtDate(purchase.date)}</span>
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs font-semibold text-ink-400 w-20 flex-shrink-0">Para Bir.</span>
                  <span className="text-sm text-ink-700 font-medium">{purchase.currency}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="text-xs font-semibold text-ink-400 block mb-1">Açıklama</span>
                  <p className="text-sm text-ink-600">{purchase.notes || <span className="text-ink-300 italic">—</span>}</p>
                </div>
              </div>
            </div>

            {/* Payment history */}
            {purchase.payments?.length > 0 && (
              <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
                <div className="px-4 py-2.5 border-b border-ink-100 bg-ink-50">
                  <p className="text-xs font-bold text-ink-500 uppercase tracking-wide">Ödeme Geçmişi</p>
                </div>
                <div className="p-4 space-y-2">
                  {purchase.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-ink-500">{fmtDate(p.date)} — {p.method}</span>
                      <span className="font-semibold text-brand-700">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between text-sm font-bold pt-2 border-t ${remaining > 0 ? 'text-red-500' : 'text-brand-700'}`}>
                    <span>{remaining > 0 ? 'Kalan Borç' : 'Tümü Ödendi ✓'}</span>
                    {remaining > 0 && <span>{fmt(remaining)} {purchase.currency}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Supplier contact */}
            {(purchase.supplier?.phone || purchase.supplier?.email) && (
              <div className="bg-white rounded-xl shadow-card p-4 space-y-1 text-sm border border-ink-200/80">
                {purchase.supplier?.phone && (
                  <div className="flex gap-2"><span className="text-ink-400 w-16">Telefon</span><span className="text-ink-700">{purchase.supplier.phone}</span></div>
                )}
                {purchase.supplier?.email && (
                  <div className="flex gap-2"><span className="text-ink-400 w-16">E-posta</span><span className="text-ink-700">{purchase.supplier.email}</span></div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Details */}
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80">
            {/* Header */}
            <div className="bg-emerald-600 px-5 py-3">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest">Detaylar</h2>
            </div>

            {/* Items table */}
            {purchaseMaterials.length === 0 ? (
              <div className="text-center py-12 text-ink-400 text-sm italic">Bu alışta kalem yok. Eklemek için Düzenle düğmesini kullanın.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-ink-500 bg-ink-50 border-b">
                      <th className="px-4 py-3 text-center w-8">#</th>
                      <th className="px-4 py-3 text-left">Açıklama</th>
                      <th className="px-4 py-3 text-left">Hedef</th>
                      <th className="px-4 py-3 text-right">Miktar</th>
                      <th className="px-4 py-3 text-right">Fiyat</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {purchaseMaterials.map((pm: any, idx: number) => {
                      const tutar = (pm.kgAmount ?? 0) * (pm.pricePerKg ?? 0);
                      return (
                        <tr key={pm.id} className="hover:bg-ink-50/50">
                          <td className="px-4 py-3 text-center text-xs text-ink-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            {pm.material ? (
                              <p className="font-medium text-ink-700">{pm.material.name}</p>
                            ) : pm.product ? (
                              <div>
                                <p className="font-medium text-ink-700">{pm.product.name}</p>
                                {pm.product.code && <p className="text-xs font-mono text-ink-400">[{pm.product.code}]</p>}
                              </div>
                            ) : <span className="text-ink-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {pm.subcontractor ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                <Factory className="w-2.5 h-2.5" />
                                {pm.subcontractor.name}
                              </span>
                            ) : (
                              <span className="text-xs text-ink-400">Ana Depo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-ink-700">{pm.kgAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</p>
                            <p className="text-xs text-ink-400">
                              Stok: {(pm.material?.stock ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-ink-600">
                            {pm.pricePerKg ? pm.pricePerKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-ink-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-ink-700">
                            {tutar > 0 ? tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-ink-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}


            {/* Totals summary */}
            <div className="px-5 py-4 border-t border-ink-100 bg-ink-50/60">
              <div className="max-w-xs ml-auto space-y-2 text-sm">
                <div className="flex justify-between text-ink-600">
                  <span>Toplam Miktar</span>
                  <span className="font-medium">{totalKg.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
                </div>
                <div className="flex justify-between text-ink-600">
                  <span>Brüt Toplam</span>
                  <span className="font-medium">{fmt(purchase.total)} {purchase.currency}</span>
                </div>
                <div className="flex justify-between text-brand-700">
                  <span>Ödenen</span>
                  <span className="font-medium">{fmt(purchase.paidAmount)} {purchase.currency}</span>
                </div>
                <div className={`flex justify-between font-bold text-base pt-2 border-t ${remaining > 0 ? 'text-red-500' : 'text-brand-700'}`}>
                  <span>KALAN BORÇ</span>
                  <span>{fmt(remaining)} {purchase.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-ink-50">İptal</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Tamam</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

async function handlePdf(purchase: any) {
  const { default: jsPDF } = await import('jspdf');
  const tr = (s: string) => (s || '').replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');
  const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; let y = M;
  doc.setFillColor(13, 148, 136); doc.rect(0, 0, W, 24, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('ALIS FATURASI', M, 11);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(tr(purchase.invoiceNo || ''), M, 19);
  doc.text(tr(purchase.supplier?.name ?? ''), W - M, 11, { align: 'right' });
  doc.text(new Date(purchase.date).toLocaleDateString('tr-TR'), W - M, 19, { align: 'right' });
  y = 34;
  doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Toplam: ${fmt2(purchase.total)} ${purchase.currency}`, M, y); y += 8;
  doc.text(`Odenen: ${fmt2(purchase.paidAmount)} ${purchase.currency}`, M, y); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Kalan: ${fmt2(purchase.total - purchase.paidAmount)} ${purchase.currency}`, M, y);
  doc.save(`${tr(purchase.invoiceNo || 'alis-faturasi')}.pdf`);
}
