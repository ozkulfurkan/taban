'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import {
  Loader2, Printer, Pencil, X, CreditCard, User,
  Plus, Trash2, Save, ChevronLeft,
} from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR');
const toInput = (d: string | Date | null) => d ? new Date(d).toISOString().split('T')[0] : '';

const METHODS = ['Nakit', 'Havale/EFT', 'Çek', 'Kredi Kartı', 'POS'];

function emptyItem() {
  return { description: '', quantity: '1', unitPrice: '', discount: '0', notes: '' };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});
  const [editItems, setEditItems] = useState<any[]>([]);

  // Payment form state
  const [payForm, setPayForm] = useState({
    amount: '', method: 'Nakit', date: new Date().toISOString().split('T')[0], notes: '',
  });

  const load = useCallback(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.error) {
          setInvoice(d);
          setEditForm({
            invoiceNo: d.invoiceNo || '',
            date: toInput(d.date),
            dueDate: toInput(d.dueDate),
            currency: d.currency || 'TRY',
            vatRate: String(d.vatRate ?? 0),
            notes: d.notes || '',
          });
          setEditItems((d.items || []).map((i: any) => ({
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: String(i.unitPrice),
            discount: String(i.discount ?? 0),
            notes: i.notes || '',
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  // Compute preview totals from editItems
  const previewTotals = editItems.reduce((acc, i) => {
    const qty = parseFloat(i.quantity) || 0;
    const price = parseFloat(i.unitPrice) || 0;
    const disc = parseFloat(i.discount) || 0;
    const tutar = qty * price;
    const indirimTL = tutar * disc / 100;
    const net = tutar - indirimTL;
    return {
      totalQty: acc.totalQty + qty,
      brut: acc.brut + tutar,
      indirim: acc.indirim + indirimTL,
      net: acc.net + net,
    };
  }, { totalQty: 0, brut: 0, indirim: 0, net: 0 });
  const vatRate = parseFloat(editForm.vatRate) || (invoice?.vatRate ?? 0);
  const kdvAmount = previewTotals.net * vatRate / 100;
  const toplam = previewTotals.net + kdvAmount;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          vatRate: parseFloat(editForm.vatRate) || 0,
          items: editItems.map(i => ({
            description: i.description,
            quantity: parseFloat(i.quantity) || 0,
            unitPrice: parseFloat(i.unitPrice) || 0,
            discount: parseFloat(i.discount) || 0,
            notes: i.notes || null,
          })),
        }),
      });
      const updated = await res.json();
      setInvoice(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Bu fatura silinecek. Bağlı ödemeler de silinir. Emin misiniz?')) return;
    setDeleting(true);
    await fetch(`/api/invoices/${params.id}`, { method: 'DELETE' });
    router.back();
  };

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
    } finally { setPayLoading(false); }
  };

  const addItem = () => setEditItems(p => [...p, emptyItem()]);
  const removeItem = (i: number) => setEditItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i: number, f: string, v: string) =>
    setEditItems(p => p.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></AppShell>;
  if (!invoice) return <AppShell><div className="text-center py-16 text-slate-400">Fatura bulunamadı</div></AppShell>;

  const remaining = invoice.total - invoice.paidAmount;

  // Computed display values from invoice items
  const displayTotals = (invoice.items || []).reduce((acc: any, i: any) => {
    const tutar = i.quantity * i.unitPrice;
    const indirimTL = tutar * (i.discount ?? 0) / 100;
    const net = tutar - indirimTL;
    return { totalQty: acc.totalQty + i.quantity, brut: acc.brut + tutar, indirim: acc.indirim + indirimTL, net: acc.net + net };
  }, { totalQty: 0, brut: 0, indirim: 0, net: 0 });

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl">

        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm">
          <ChevronLeft className="w-4 h-4" /> Geri Dön
        </button>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            const { default: jsPDF } = require('jspdf'); void handlePdf(invoice);
          }}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Yazdır
          </button>
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
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            <X className="w-4 h-4" /> İptal Et
          </button>
          <button onClick={() => setShowPayForm(s => !s)}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
            <CreditCard className="w-4 h-4" /> Tahsilat Gir
          </button>
          <Link href={`/customers/${invoice.customerId}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 text-white rounded-lg text-sm font-medium">
            <User className="w-4 h-4" /> Müşteri Sayfası
          </Link>
        </div>

        {/* Payment form inline */}
        {showPayForm && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <form onSubmit={handlePayment} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Tutar</label>
                <input required type="number" step="0.01" value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Kalan: ${fmt(remaining)}`}
                  className="w-36 px-3 py-2 border border-green-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Yöntem</label>
                <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}
                  className="px-3 py-2 border border-green-300 rounded-lg text-sm outline-none bg-white">
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">Tarih</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                  className="px-3 py-2 border border-green-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-green-700 mb-1">Not</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm outline-none" />
              </div>
              <button type="submit" disabled={payLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Kaydet
              </button>
              <button type="button" onClick={() => setShowPayForm(false)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                İptal
              </button>
            </form>
          </div>
        )}

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Customer info + Invoice meta */}
          <div className="space-y-3">
            {/* Customer header */}
            <div className="bg-blue-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{invoice.customer?.name}</p>
                {invoice.customer?.taxId && <p className="text-blue-200 text-xs mt-0.5">VKN: {invoice.customer.taxId}</p>}
              </div>
              <User className="w-5 h-5 text-blue-300" />
            </div>

            {/* Invoice meta card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {editing && (
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">Düzenleme modu aktif</p>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Belge No', field: 'invoiceNo', type: 'text', value: invoice.invoiceNo },
                  { label: 'Tarihi', field: 'date', type: 'date', value: fmtDate(invoice.date) },
                  { label: 'Vadesi', field: 'dueDate', type: 'date', value: invoice.dueDate ? fmtDate(invoice.dueDate) : '—' },
                  { label: 'Para Birimi', field: 'currency', type: 'select', value: invoice.currency },
                  { label: 'KDV Oranı', field: 'vatRate', type: 'number', value: `%${invoice.vatRate}` },
                ].map(row => (
                  <div key={row.field} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    {editing ? (
                      row.type === 'select' ? (
                        <select value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm bg-white outline-none">
                          {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input type={row.type} value={editForm[row.field] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [row.field]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                      )
                    ) : (
                      <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                    )}
                  </div>
                ))}
                {/* Notes */}
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Açıklama</span>
                  {editing ? (
                    <textarea value={editForm.notes || ''} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  ) : (
                    <p className="text-sm text-slate-600">{invoice.notes || <span className="text-slate-300 italic">—</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment summary */}
            {invoice.payments?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Tahsilat Geçmişi</p>
                <div className="space-y-2">
                  {invoice.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-slate-500">{fmtDate(p.date)} — {p.method}</span>
                      <span className="font-semibold text-green-600">+{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-500 pt-2 border-t">
                      <span>Kalan</span>
                      <span>{fmt(remaining)} {invoice.currency}</span>
                    </div>
                  )}
                  {remaining <= 0 && (
                    <div className="text-center text-xs text-green-600 font-semibold pt-1">Tümü Tahsil Edildi ✓</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Items + Totals */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-green-600 px-4 py-3 flex items-center justify-between">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">Ürün / Hizmetler</h2>
                {editing && (
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" /> Satır Ekle
                  </button>
                )}
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-green-50 text-xs font-semibold text-slate-600 border-b border-green-100">
                      <th className="px-3 py-2.5 text-left w-8">#</th>
                      <th className="px-3 py-2.5 text-left">Açıklama</th>
                      <th className="px-3 py-2.5 text-right">Miktar</th>
                      <th className="px-3 py-2.5 text-right">Fiyat</th>
                      <th className="px-3 py-2.5 text-right">Tutar</th>
                      <th className="px-3 py-2.5 text-right">İndirim</th>
                      <th className="px-3 py-2.5 text-right">Net</th>
                      <th className="px-3 py-2.5 text-right">KDV</th>
                      {editing && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {editing ? editItems.map((item, idx) => {
                      const qty = parseFloat(item.quantity) || 0;
                      const price = parseFloat(item.unitPrice) || 0;
                      const disc = parseFloat(item.discount) || 0;
                      const tutar = qty * price;
                      const indirimTL = tutar * disc / 100;
                      const net = tutar - indirimTL;
                      const kdv = net * vatRate / 100;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <input value={item.description} onChange={e => setItem(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" value={item.unitPrice} onChange={e => setItem(idx, 'unitPrice', e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmt(tutar)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <input type="number" step="0.01" min="0" max="100" value={item.discount} onChange={e => setItem(idx, 'discount', e.target.value)}
                                className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-right outline-none focus:ring-1 focus:ring-blue-400" />
                              <span className="text-xs text-slate-400">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700 font-medium">{fmt(net)}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{fmt(kdv)}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (invoice.items || []).map((item: any, idx: number) => {
                      const tutar = item.quantity * item.unitPrice;
                      const indirimTL = tutar * (item.discount ?? 0) / 100;
                      const net = tutar - indirimTL;
                      const kdv = net * invoice.vatRate / 100;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2.5 text-slate-700">{item.description}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{item.quantity.toLocaleString('tr-TR')}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmt(item.unitPrice)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmt(tutar)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{fmt(indirimTL)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-700">{fmt(net)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{fmt(kdv)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals summary */}
              <div className="px-4 py-4 border-t border-slate-100">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-sm">
                    {(() => {
                      const t = editing ? previewTotals : displayTotals;
                      const vr = editing ? vatRate : invoice.vatRate;
                      const kdv = t.net * vr / 100;
                      const total = t.net + kdv;
                      return (
                        <>
                          <div className="flex justify-between text-slate-500">
                            <span>Toplam Miktar</span>
                            <span>{t.totalQty.toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Brüt Toplam</span>
                            <span>{fmt(t.brut)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>İndirim</span>
                            <span>{fmt(t.indirim)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Net Toplam</span>
                            <span>{fmt(t.net)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>KDV (%{vr})</span>
                            <span>{fmt(kdv)} {editForm.currency || invoice.currency}</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-800 text-base pt-2 border-t">
                            <span>TOPLAM</span>
                            <span>{fmt(editing ? total : invoice.total)} {editForm.currency || invoice.currency}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

async function handlePdf(invoice: any) {
  const { default: jsPDF } = await import('jspdf');
  const tr = (s: string) => (s || '').replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
    .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C');
  const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; let y = M;
  doc.setFillColor(37,99,235); doc.rect(0,0,W,24,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('FATURA', M, 11);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(tr(invoice.invoiceNo), M, 19);
  doc.text(tr(invoice.customer?.name ?? ''), W-M, 11, { align: 'right' });
  doc.text(new Date(invoice.date).toLocaleDateString('tr-TR'), W-M, 19, { align: 'right' });
  y = 34;
  doc.setTextColor(30,30,30); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.setFillColor(241,245,249); doc.rect(M, y-3, W-2*M, 7, 'F');
  const cols = [8,60,18,22,22,18,22,22];
  const headers = ['#','Aciklama','Miktar','Fiyat','Tutar','Indirim','Net','KDV'];
  let x = M;
  headers.forEach((h,i) => { doc.text(h, x+1, y); x += cols[i]; }); y += 6;
  doc.setFont('helvetica','normal');
  (invoice.items||[]).forEach((item: any, idx: number) => {
    if (y > 260) { doc.addPage(); y = 15; }
    const tutar = item.quantity * item.unitPrice;
    const indirim = tutar * (item.discount??0)/100;
    const net = tutar - indirim;
    const kdv = net * invoice.vatRate / 100;
    x = M;
    [String(idx+1), tr(item.description).substring(0,30), String(item.quantity),
      fmt2(item.unitPrice), fmt2(tutar), fmt2(indirim), fmt2(net), fmt2(kdv)
    ].forEach((v,i) => { doc.text(v, x+1, y); x += cols[i]; });
    doc.setDrawColor(230,230,230); doc.line(M, y+2, W-M, y+2); y += 6;
  });
  y += 4; doc.setFont('helvetica','bold');
  doc.text(`Net Toplam: ${fmt2(invoice.subtotal)}   KDV (%${invoice.vatRate}): ${fmt2(invoice.vatAmount)}   TOPLAM: ${fmt2(invoice.total)} ${invoice.currency}`, M, y);
  doc.save(`${tr(invoice.invoiceNo)}.pdf`);
}
