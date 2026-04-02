'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import {
  Plus, Trash2, Loader2, FileText, ArrowLeft,
  Banknote, CreditCard, Calendar, X
} from 'lucide-react';

function tr(text: string): string {
  return String(text ?? '')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

interface RowEntry {
  id: string;
  tabanAd: string;
  tabanKod: string;
  renk: string;
  birimFiyat: string;
  adetler: Record<string, string>;
}

interface CustomerInfo { firmName: string; address: string; taxId: string; email: string; }

const newRow = (birimFiyat = ''): RowEntry => ({
  id: Math.random().toString(36).slice(2),
  tabanAd: '', tabanKod: '', renk: '', birimFiyat, adetler: {},
});

function QuoteForm() {
  const { formatCurrency } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const calcId = searchParams.get('calcId');
  const customerId = searchParams.get('customerId');

  const [docType, setDocType] = useState<'teklif' | 'siparis'>('teklif');
  const [calcName, setCalcName] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [customer, setCustomer] = useState<CustomerInfo>({ firmName: '', address: '', taxId: '', email: '' });
  const [rows, setRows] = useState<RowEntry[]>([newRow()]);
  const [numaralar, setNumaralar] = useState<string[]>([]);
  const [numaraInput, setNumaraInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'cek'>('nakit');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [checkMonths, setCheckMonths] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [notes, setNotes] = useState('');
  const [company, setCompany] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);

  useEffect(() => {
    fetch('/api/company').then(r => r.json()).then(d => {
      if (!d?.error) {
        setCompany(d);
        if (d?.vatRate) setVatRate(String(d.vatRate));
      }
    }).catch(() => {});
    fetch('/api/customers').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCustomers(d);
    }).catch(() => {});
    if (calcId) {
      fetch(`/api/calculations/${calcId}`).then(r => r.json()).then(d => {
        if (!d?.error) {
          setCalcName(d.name ?? '');
          setRows([newRow(String(d.sellingPrice?.toFixed(4) ?? ''))]);
        }
      }).catch(() => {});
    }
    if (customerId) {
      fetch(`/api/customers/${customerId}`).then(r => r.json()).then(d => {
        if (!d?.error) {
          setCustomer({
            firmName: d.name ?? '',
            address: d.address ?? '',
            taxId: d.taxId ?? '',
            email: d.email ?? '',
          });
        }
      }).catch(() => {});
    }
  }, [calcId, customerId]);

  // Numara helpers
  const addNumara = () => {
    const n = numaraInput.trim();
    if (!n || numaralar.includes(n)) return;
    setNumaralar(prev => [...prev, n]);
    setNumaraInput('');
  };
  const removeNumara = (n: string) => setNumaralar(prev => prev.filter(x => x !== n));

  // Row helpers
  const updateRow = (id: string, field: keyof Omit<RowEntry, 'adetler' | 'id'>, val: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const updateAdet = (rowId: string, numara: string, val: string) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, adetler: { ...r.adetler, [numara]: val } } : r));
  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const openProductModal = () => {
    setProductSearch('');
    setShowProductModal(true);
    fetch('/api/products').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProducts(d);
    }).catch(() => {});
  };

  const selectProduct = (prod: any) => {
    // Merge product sizes into numaralar
    const prodSizes: string[] = prod.sizes || [];
    if (prodSizes.length > 0) {
      setNumaralar(prev => {
        const merged = [...prev];
        prodSizes.forEach(s => { if (!merged.includes(s)) merged.push(s); });
        return merged;
      });
    }
    // Add a new row with product info pre-filled
    setRows(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      tabanAd: prod.name || '',
      tabanKod: prod.code || '',
      renk: '',
      birimFiyat: String(prod.unitPrice ?? ''),
      adetler: {},
    }]);
    setShowProductModal(false);
  };

  // Calculations
  const rowTotal = (row: RowEntry) => numaralar.reduce((s, n) => s + (Number(row.adetler[n]) || 0), 0);
  const rowFiyat = (row: RowEntry) => rowTotal(row) * (Number(row.birimFiyat) || 0);
  const subtotal = rows.reduce((s, r) => s + rowFiyat(r), 0);
  const vatAmount = subtotal * (Number(vatRate) || 0) / 100;
  const grandTotal = subtotal + vatAmount;
  const totalPairs = rows.reduce((s, r) => s + rowTotal(r), 0);

  const handleGeneratePdf = async () => {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + parseInt(validityDays || '30'));
      const quoteNo = `${docType === 'teklif' ? 'TKL' : 'SPR'}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`;
      const banks = (() => { try { return company?.bankInfo ? JSON.parse(company.bankInfo) : []; } catch { return []; } })();

      // Header background
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageW, 45, 'F');
      if (company?.logoUrl) { try { doc.addImage(company.logoUrl, 'PNG', 10, 5, 35, 35); } catch {} }
      const logoOffset = company?.logoUrl ? 50 : 14;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(tr(company?.name ?? 'SoleCost'), logoOffset, 18);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      if (company?.address) doc.text(tr(company.address), logoOffset, 25);
      if (company?.taxId) doc.text(tr(`VKN: ${company.taxId}`), logoOffset, 31);
      if (company?.phone) doc.text(tr(`Tel: ${company.phone}`), logoOffset, 37);

      const docTitle = docType === 'teklif' ? 'TEKLIF' : 'SIPARIS ONAYI';
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text(docTitle, pageW - 14, 20, { align: 'right' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(tr(`No: ${quoteNo}`), pageW - 14, 28, { align: 'right' });
      doc.text(tr(`Tarih: ${now.toLocaleDateString('tr-TR')}`), pageW - 14, 34, { align: 'right' });
      if (docType === 'teklif') doc.text(tr(`Gecerli: ${validUntil.toLocaleDateString('tr-TR')}`), pageW - 14, 40, { align: 'right' });

      y = 52;
      doc.setTextColor(0, 0, 0);

      // Customer + Delivery side by side
      const colW = (pageW - 24) / 2;
      doc.setFillColor(248, 250, 252); doc.rect(10, y, colW, 28, 'F');
      doc.setDrawColor(226, 232, 240); doc.rect(10, y, colW, 28, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('MUSTERI', 13, y + 6);
      doc.setFont('helvetica', 'normal');
      if (customer.firmName) doc.text(tr(customer.firmName), 13, y + 12);
      if (customer.taxId) doc.text(tr(`VKN: ${customer.taxId}`), 13, y + 18);
      if (customer.address) doc.text(tr(customer.address.substring(0, 50)), 13, y + 24);

      const col2X = 14 + colW;
      doc.setFillColor(248, 250, 252); doc.rect(col2X, y, colW, 28, 'F');
      doc.setDrawColor(226, 232, 240); doc.rect(col2X, y, colW, 28, 'S');
      doc.setFont('helvetica', 'bold');
      doc.text('TESLIM / ODEME', col2X + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      if (deliveryDate) doc.text(tr(`Teslim: ${deliveryDate}`), col2X + 3, y + 12);
      doc.text(tr(`Odeme: ${paymentMethod === 'nakit' ? 'Nakit' : `Cek (${checkMonths} ay)`}`), col2X + 3, y + 18);
      if (customer.email) doc.text(tr(`E: ${customer.email}`), col2X + 3, y + 24);
      y += 34;

      if (calcName) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text(tr(`Urun: ${calcName}`), 14, y); y += 8;
      }

      // --- MAIN TABLE ---
      // Fixed columns: Taban Adı (35), Taban Kod (25), Renk (35), Birim Fiyat (22)
      // Dynamic: numara cols (12 each), Toplam Adet (20), Fiyat (25)
      const margin = 10;
      const fixedW = 35 + 25 + 35 + 22; // 117
      const rightW = 20 + 25; // 45
      const tableW = pageW - 2 * margin;
      const numW = numaralar.length > 0 ? Math.min(14, (tableW - fixedW - rightW) / numaralar.length) : 14;

      const cx = {
        tabanAd: margin,
        tabanKod: margin + 35,
        renk: margin + 35 + 25,
        birim: margin + 35 + 25 + 35,
        nums: (i: number) => margin + 35 + 25 + 35 + 22 + i * numW,
        toplam: margin + 35 + 25 + 35 + 22 + numaralar.length * numW,
        fiyat: margin + 35 + 25 + 35 + 22 + numaralar.length * numW + 20,
        end: pageW - margin,
      };

      // Table header
      doc.setFillColor(37, 99, 235);
      doc.rect(margin, y, tableW, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text('Taban Adi', cx.tabanAd + 1, y + 5.5);
      doc.text('Kod', cx.tabanKod + 1, y + 5.5);
      doc.text('Renk', cx.renk + 1, y + 5.5);
      doc.text('B.Fiyat', cx.birim + 1, y + 5.5);
      numaralar.forEach((n, i) => doc.text(n, cx.nums(i) + 1, y + 5.5));
      doc.text('Toplam', cx.toplam + 1, y + 5.5);
      doc.text('Fiyat', cx.fiyat + 1, y + 5.5);
      y += 8;

      doc.setTextColor(0, 0, 0);
      rows.forEach((row, i) => {
        if (y > 175) { doc.addPage(); y = 20; }
        if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, tableW, 7, 'F'); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.text(tr(row.tabanAd || '-'), cx.tabanAd + 1, y + 4.8);
        doc.text(tr(row.tabanKod || '-'), cx.tabanKod + 1, y + 4.8);
        doc.text(tr(row.renk || '-'), cx.renk + 1, y + 4.8);
        doc.text(String(Number(row.birimFiyat) || 0), cx.birim + 1, y + 4.8);
        numaralar.forEach((n, ni) => {
          doc.text(String(Number(row.adetler[n]) || 0), cx.nums(ni) + 1, y + 4.8);
        });
        doc.text(String(rowTotal(row)), cx.toplam + 1, y + 4.8);
        doc.text(formatCurrency(rowFiyat(row)), cx.fiyat + 1, y + 4.8);
        y += 7;
      });

      // Totals
      if (y > 175) { doc.addPage(); y = 20; }
      doc.setFillColor(226, 232, 240); doc.rect(margin, y, tableW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(51, 65, 85);
      doc.text(tr('Toplam Cift:'), cx.toplam - 20, y + 5);
      doc.text(String(totalPairs), cx.toplam + 1, y + 5);
      y += 7;

      if (Number(vatRate) > 0) {
        doc.setFillColor(248, 250, 252); doc.rect(margin, y, tableW, 7, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0,0,0);
        doc.text(tr('Ara Toplam (KDV Haric):'), cx.fiyat - 50, y + 5);
        doc.text(formatCurrency(subtotal), cx.fiyat + 1, y + 5);
        y += 7;

        doc.setFillColor(248, 250, 252); doc.rect(margin, y, tableW, 7, 'F');
        doc.text(tr(`KDV (%${vatRate}):`), cx.fiyat - 50, y + 5);
        doc.text(formatCurrency(vatAmount), cx.fiyat + 1, y + 5);
        y += 7;
      }

      doc.setFillColor(37, 99, 235); doc.rect(margin, y, tableW, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(tr(Number(vatRate) > 0 ? 'GENEL TOPLAM (KDV Dahil):' : 'GENEL TOPLAM:'), cx.fiyat - 55, y + 5.5);
      doc.text(formatCurrency(grandTotal), cx.fiyat + 1, y + 5.5);
      y += 12;

      // Payment & Bank
      if (y > 170) { doc.addPage(); y = 20; }
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(226, 232, 240); doc.line(margin, y, pageW - margin, y); y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(tr('Odeme Kosullari:'), margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      doc.text(tr(`Odeme Yontemi: ${paymentMethod === 'nakit' ? 'Nakit' : 'Cek'}`), margin, y); y += 5;
      if (paymentMethod === 'cek' && checkMonths) { doc.text(tr(`Cek Vadesi: ${checkMonths} ay`), margin, y); y += 5; }
      if (deliveryDate) { doc.text(tr(`Teslim Tarihi: ${deliveryDate}`), margin, y); y += 5; }

      if (banks.length > 0) {
        y += 3;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text('Banka Bilgileri:', margin, y); y += 5;
        doc.setFont('helvetica', 'normal');
        banks.forEach((b: any) => {
          if (y > 195) { doc.addPage(); y = 20; }
          doc.text(tr(`${b.bankName ?? ''} | ${b.accountName ?? ''} | IBAN: ${b.iban ?? ''}`), margin, y); y += 5;
        });
      }

      if (notes) {
        y += 3;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(tr(`Not: ${notes}`), margin, y);
      }

      const filename = docType === 'teklif'
        ? `Teklif_${customer.firmName || 'musteri'}_${quoteNo}.pdf`
        : `SiparisOnayi_${customer.firmName || 'musteri'}_${quoteNo}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Teklif Oluştur</h1>
            {calcName && <p className="text-slate-500 text-sm">{calcName}</p>}
          </div>
        </div>

        {/* Doc Type */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-3">Belge Türü</label>
          <div className="flex gap-3">
            {(['teklif', 'siparis'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors border-2 ${docType === type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {type === 'teklif' ? 'Teklif' : 'Sipariş Onayı'}
              </button>
            ))}
          </div>
        </div>

        {/* Customer */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-blue-600 text-sm uppercase tracking-wide">Müşteri Bilgileri</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">Firma Adı</label>
              <input
                value={customer.firmName}
                onChange={e => {
                  setCustomer({ ...customer, firmName: e.target.value });
                  setShowCustomerDrop(true);
                }}
                onFocus={() => setShowCustomerDrop(true)}
                onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="off"
              />
              {showCustomerDrop && customer.firmName.length > 0 && (() => {
                const q = customer.firmName.toLowerCase();
                const filtered = customers.filter(c => c.name?.toLowerCase().includes(q));
                if (!filtered.length) return null;
                return (
                  <ul className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filtered.map(c => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={() => {
                            setCustomer({
                              firmName: c.name ?? '',
                              address: c.address ?? '',
                              taxId: c.taxId ?? '',
                              email: c.email ?? '',
                            });
                            setShowCustomerDrop(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm text-slate-700"
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.taxId && <span className="text-slate-400 text-xs ml-2">VKN: {c.taxId}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vergi Kimlik No</label>
              <input value={customer.taxId} onChange={e => setCustomer({ ...customer, taxId: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">E-posta</label>
              <input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Geçerlilik Süresi (Gün)</label>
              <input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Firma Adresi</label>
              <textarea value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-blue-600 text-sm uppercase tracking-wide mb-4">Taban & Numara Bilgileri</h2>

            {/* Numara yönetimi */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  value={numaraInput}
                  onChange={e => setNumaraInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNumara()}
                  placeholder="Numara girin (ör. 36)"
                  className="w-40 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={addNumara}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Numara Ekle
                </button>
              </div>
              {numaralar.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {numaralar.map(n => (
                    <span key={n} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {n}
                      <button onClick={() => removeNumara(n)} className="hover:text-red-600 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: `${600 + numaralar.length * 80}px` }}>
              <thead>
                <tr className="bg-blue-600 text-white text-xs font-semibold uppercase tracking-wide">
                  <th className="px-3 py-3 text-left whitespace-nowrap">Taban Adı</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Taban Kod</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Renk</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Birim Fiyat</th>
                  {numaralar.map(n => (
                    <th key={n} className="px-3 py-3 text-center whitespace-nowrap">{n}</th>
                  ))}
                  <th className="px-3 py-3 text-right whitespace-nowrap">Toplam Adet</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Fiyat</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {numaralar.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm italic">
                      Önce yukarıdan numara ekleyin
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-2 py-2">
                        <input
                          value={row.tabanAd}
                          onChange={e => updateRow(row.id, 'tabanAd', e.target.value)}
                          placeholder="Campus"
                          className="w-28 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.tabanKod}
                          onChange={e => updateRow(row.id, 'tabanKod', e.target.value)}
                          placeholder="Ozk001"
                          className="w-24 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.renk}
                          onChange={e => updateRow(row.id, 'renk', e.target.value)}
                          placeholder="Siyah/Beyaz"
                          className="w-32 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number" step="0.0001"
                          value={row.birimFiyat}
                          onChange={e => updateRow(row.id, 'birimFiyat', e.target.value)}
                          placeholder="0.00"
                          className="w-24 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      {numaralar.map(n => (
                        <td key={n} className="px-2 py-2 text-center">
                          <input
                            type="number" min="0"
                            value={row.adetler[n] ?? ''}
                            onChange={e => updateAdet(row.id, n, e.target.value)}
                            placeholder="0"
                            className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">
                        {rowTotal(row)} çift
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">
                        {formatCurrency(rowFiyat(row))}
                      </td>
                      <td className="px-2 py-2">
                        {rows.length > 1 && (
                          <button onClick={() => removeRow(row.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {numaralar.length > 0 && rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 text-xs font-semibold text-slate-600">
                    <td colSpan={4} className="px-3 py-2">TOPLAM</td>
                    {numaralar.map(n => (
                      <td key={n} className="px-3 py-2 text-center">
                        {rows.reduce((s, r) => s + (Number(r.adetler[n]) || 0), 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">{totalPairs} çift</td>
                    <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(subtotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="p-4 border-t flex justify-between items-center flex-wrap gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setRows(prev => [...prev, newRow()])}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Satır Ekle
              </button>
              <button
                onClick={openProductModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Ürün Ekle
              </button>
            </div>

            {/* Summary */}
            <div className="text-right space-y-1">
              {Number(vatRate) > 0 ? (
                <>
                  <div className="text-sm text-slate-600">
                    Ara Toplam: <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    KDV (%{vatRate}): <span className="font-semibold text-slate-800">{formatCurrency(vatAmount)}</span>
                  </div>
                  <div className="text-base font-bold text-blue-700">
                    Genel Toplam (KDV Dahil): {formatCurrency(grandTotal)}
                  </div>
                </>
              ) : (
                <div className="text-base font-bold text-blue-700">
                  Genel Toplam: {formatCurrency(subtotal)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-blue-600 text-sm uppercase tracking-wide">Ödeme & Teslimat</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setPaymentMethod('nakit')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border-2 transition-colors ${paymentMethod === 'nakit' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              <Banknote className="w-4 h-4" /> Nakit
            </button>
            <button
              onClick={() => setPaymentMethod('cek')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border-2 transition-colors ${paymentMethod === 'cek' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              <CreditCard className="w-4 h-4" /> Çek
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Teslim Tarihi</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {paymentMethod === 'cek' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kaç Aylık Çek</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" value={checkMonths} onChange={e => setCheckMonths(e.target.value)} placeholder="3" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-slate-500 text-sm whitespace-nowrap">ay vadeli</span>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">KDV Oranı</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" value={vatRate} onChange={e => setVatRate(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="text-slate-500 text-sm">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGeneratePdf}
          disabled={generating}
          className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-60 shadow-lg shadow-green-600/20"
        >
          {generating ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
          {docType === 'teklif' ? 'Teklif PDF Oluştur' : 'Sipariş Onayı PDF Oluştur'}
        </button>
      </div>

      {/* Product Picker Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="bg-blue-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-semibold">Ürün Seç</h3>
              <button onClick={() => setShowProductModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b">
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Ürün adı veya kodu ara..."
                autoFocus
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {products.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Ürün bulunamadı</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {products
                    .filter(p => {
                      const q = productSearch.toLowerCase();
                      return !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q);
                    })
                    .map(prod => (
                      <li key={prod.id}>
                        <button
                          onClick={() => selectProduct(prod)}
                          className="w-full flex items-center justify-between px-5 py-3 hover:bg-blue-50 transition-colors text-left"
                        >
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{prod.name}</p>
                            <p className="text-xs text-slate-400">{prod.code ? `Kod: ${prod.code}` : ''}</p>
                            {(prod.sizes || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {prod.sizes.map((s: string) => (
                                  <span key={s} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-blue-600 text-sm">{prod.unitPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-slate-400">{prod.currency}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function QuoteNewPage() {
  return (
    <Suspense>
      <QuoteForm />
    </Suspense>
  );
}
