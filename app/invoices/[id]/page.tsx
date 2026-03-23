'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { ArrowLeft, Loader2, Download, Plus, CheckCircle2 } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Taslak',   color: 'bg-slate-100 text-slate-600' },
  PENDING:   { label: 'Bekleyen', color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Kısmi',    color: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Ödendi',   color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'İptal',    color: 'bg-red-100 text-red-600' },
};

const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı'];

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '' });

  const load = () => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(d => { if (!d?.error) setInvoice(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [params?.id]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return;
    setPayLoading(true);
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: payForm.amount,
          currency: invoice.currency,
          date: payForm.date,
          method: payForm.method,
          notes: payForm.notes,
        }),
      });
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '' });
      load();
    } catch (e) { console.error(e); }
    finally { setPayLoading(false); }
  };

  const handlePdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    if (!invoice) return;

    const tr = (s: string) => s
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ş/g, 's').replace(/Ş/g, 'S')
      .replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const margin = 15;
    let y = margin;

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('FATURA', margin, 12);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(tr(invoice.invoiceNo), margin, 20);
    doc.setFontSize(9);
    const stLabel = STATUS_LABELS[invoice.status]?.label ?? invoice.status;
    doc.text(tr(stLabel), W - margin, 20, { align: 'right' });

    y = 38;
    doc.setTextColor(30, 30, 30);

    // Customer info
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('MUSTERI', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(tr(invoice.customer?.name ?? ''), margin, y);
    if (invoice.customer?.taxId) { y += 5; doc.setFontSize(8); doc.text(tr(`VKN: ${invoice.customer.taxId}`), margin, y); }
    if (invoice.customer?.phone) { y += 5; doc.text(tr(`Tel: ${invoice.customer.phone}`), margin, y); }

    // Dates (right side)
    let dy = 38;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
    doc.text('TARIH', W - margin - 40, dy);
    dy += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
    doc.text(new Date(invoice.date).toLocaleDateString('tr-TR'), W - margin - 40, dy);
    if (invoice.dueDate) {
      dy += 5;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('VADE', W - margin - 40, dy);
      dy += 5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
      doc.text(new Date(invoice.dueDate).toLocaleDateString('tr-TR'), W - margin - 40, dy);
    }

    y = Math.max(y, dy) + 10;

    // Items table header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 3, W - 2 * margin, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
    doc.text('ACIKLAMA', margin + 1, y + 2);
    doc.text('MIKTAR', W - margin - 70, y + 2, { align: 'right' });
    doc.text('B.FIYAT', W - margin - 38, y + 2, { align: 'right' });
    doc.text('TOPLAM', W - margin, y + 2, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    invoice.items?.forEach((item: any) => {
      doc.text(tr(item.description), margin + 1, y);
      doc.text(String(item.quantity), W - margin - 70, y, { align: 'right' });
      doc.text(item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }), W - margin - 38, y, { align: 'right' });
      doc.text(item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 }), W - margin, y, { align: 'right' });
      y += 6;
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y - 1, W - margin, y - 1);
    });

    y += 4;
    // Totals
    const totalsX = W - margin - 70;
    doc.setFontSize(9);
    doc.text('Ara Toplam:', totalsX, y); doc.text(`${invoice.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${invoice.currency}`, W - margin, y, { align: 'right' }); y += 6;
    if (invoice.vatRate > 0) {
      doc.text(`KDV (%${invoice.vatRate}):`, totalsX, y); doc.text(`${invoice.vatAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${invoice.currency}`, W - margin, y, { align: 'right' }); y += 6;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(totalsX - 2, y - 4, W - margin - totalsX + 2, 8, 'F');
    doc.text('GENEL TOPLAM:', totalsX, y); doc.text(`${invoice.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${invoice.currency}`, W - margin, y, { align: 'right' });
    y += 10;

    if (invoice.paidAmount > 0) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(22, 163, 74);
      doc.text(`Odenen: ${invoice.paidAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${invoice.currency}`, W - margin, y, { align: 'right' });
      y += 6;
      const remaining = invoice.total - invoice.paidAmount;
      if (remaining > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Kalan: ${remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${invoice.currency}`, W - margin, y, { align: 'right' });
      }
    }

    if (invoice.notes) {
      y += 8;
      doc.setTextColor(100, 100, 100); doc.setFontSize(8);
      doc.text(tr(`Not: ${invoice.notes}`), margin, y);
    }

    doc.save(`${invoice.invoiceNo}.pdf`);
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  if (!invoice) return <AppShell><div className="text-center py-16 text-slate-400">Fatura bulunamadı</div></AppShell>;

  const remaining = invoice.total - invoice.paidAmount;
  const st = STATUS_LABELS[invoice.status] ?? STATUS_LABELS.PENDING;

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">{invoice.invoiceNo}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className="text-slate-500 text-sm">{invoice.customer?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePdf} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              <Download className="w-4 h-4" /> PDF
            </button>
            {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
              <button onClick={() => setShowPayForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Ödeme Kaydet
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Toplam</p>
            <p className="text-lg font-bold text-slate-800">{invoice.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400">{invoice.currency}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Ödenen</p>
            <p className="text-lg font-bold text-green-600">{invoice.paidAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400">{invoice.currency}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Kalan</p>
            <p className={`text-lg font-bold ${remaining > 0 ? 'text-red-500' : 'text-green-600'}`}>{remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400">{invoice.currency}</p>
          </div>
        </div>

        {/* Payment Form */}
        {showPayForm && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Ödeme Kaydet
            </h3>
            <form onSubmit={handlePayment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Tutar *</label>
                <input
                  required type="number" step="0.01" min="0.01"
                  value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Max: ${remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Yöntem</label>
                <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))} className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none bg-white">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Tarih</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Not</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none" />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="button" onClick={() => setShowPayForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
                <button type="submit" disabled={payLoading} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Kaydet
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invoice Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tarih</p>
              <p className="font-medium text-slate-700">{new Date(invoice.date).toLocaleDateString('tr-TR')}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Vade</p>
                <p className="font-medium text-slate-700">{new Date(invoice.dueDate).toLocaleDateString('tr-TR')}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Para Birimi</p>
              <p className="font-medium text-slate-700">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">KDV</p>
              <p className="font-medium text-slate-700">%{invoice.vatRate}</p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm border-t pt-4">
            <thead>
              <tr className="text-xs text-slate-500 font-medium border-b">
                <th className="text-left py-2">Açıklama</th>
                <th className="text-right py-2 px-3">Miktar</th>
                <th className="text-right py-2 px-3">Birim Fiyat</th>
                <th className="text-right py-2">Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items?.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-2 text-slate-700">{item.description}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{item.quantity}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Ara Toplam</span>
              <span>{invoice.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}</span>
            </div>
            {invoice.vatRate > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>KDV (%{invoice.vatRate})</span>
                <span>{invoice.vatAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-800 text-base border-t pt-2">
              <span>Genel Toplam</span>
              <span>{invoice.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-400 mb-1">Notlar</p>
              <p className="text-sm text-slate-600">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Payment History */}
        {invoice.payments?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-slate-700 mb-4">Ödeme Geçmişi</h3>
            <div className="space-y-2">
              {invoice.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{new Date(p.date).toLocaleDateString('tr-TR')} — {p.method}</p>
                    {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
                  </div>
                  <span className="font-semibold text-green-600">+{p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {p.currency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
