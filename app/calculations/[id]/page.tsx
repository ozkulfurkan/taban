'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { ArrowLeft, FileDown, Loader2, Package, Wrench, Paintbrush, TrendingUp, Pencil, Copy, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

function tr(text: string): string {
  return String(text ?? '')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

export default function CalculationDetailPage() {
  const { t, formatCurrency } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [calc, setCalc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/calculations/${params.id}`)
      .then((r) => r.json())
      .then((d) => setCalc(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params?.id]);

  const handleExportPdf = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const c = calc;
      if (!c) return;

      doc.setFontSize(18);
      doc.text(tr('SoleCost - ' + (c.name ?? '')), 14, 22);
      doc.setFontSize(10);
      doc.text(tr(`Tarih: ${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}`), 14, 30);

      let y = 42;
      doc.setFontSize(13);
      doc.text(tr('Parcalar'), 14, y);
      y += 8;
      doc.setFontSize(9);

      (c.parts ?? []).forEach((p: any) => {
        doc.text(tr(`${p.partName ?? '-'}  |  ${p.material?.name ?? '-'}  |  ${p.grossWeight ?? 0}g  |  Fire: ${p.wasteRate ?? 0}%  |  Net: ${p.netWeight?.toFixed?.(2) ?? '0'}g  |  ${formatCurrency(p.cost ?? 0)}`), 14, y);
        y += 6;
      });

      y += 6;
      doc.setFontSize(11);
      doc.text(tr(`Toplam Malzeme Maliyeti: ${formatCurrency(c.totalMaterialCost ?? 0)}`), 14, y); y += 7;
      doc.text(tr(`Iscilik Maliyeti: ${formatCurrency(c.laborCostPerPair ?? 0)}`), 14, y); y += 7;
      doc.text(tr(`Boya Maliyeti: ${formatCurrency(c.paintCost ?? 0)}`), 14, y); y += 7;
      doc.setFontSize(13);
      doc.text(tr(`Toplam Maliyet: ${formatCurrency(c.totalCost ?? 0)}`), 14, y); y += 8;
      doc.text(tr(`Kar Marji: ${c.profitMargin ?? 0}%`), 14, y); y += 8;
      doc.text(tr(`Satis Fiyati (KDV Haric): ${formatCurrency(c.sellingPrice ?? 0)}`), 14, y); y += 8;
      if ((c.vatRate ?? 0) > 0) {
        doc.text(tr(`KDV (%${c.vatRate}): ${formatCurrency((c.sellingPriceWithVat ?? 0) - (c.sellingPrice ?? 0))}`), 14, y); y += 8;
        doc.text(tr(`Satis Fiyati (KDV Dahil): ${formatCurrency(c.sellingPriceWithVat ?? 0)}`), 14, y);
      }

      doc.save(`SoleCost_${c.name ?? 'calc'}.pdf`);
    } catch (e) {
      console.error('PDF export error:', e);
    }
  };

  if (loading) {
    return <AppShell><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AppShell>;
  }

  if (!calc || calc.error) {
    return <AppShell><div className="text-center py-12 text-slate-400">{t('common', 'noData')}</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{calc.name ?? ''}</h1>
              <p className="text-slate-500 text-sm">{calc.createdAt ? new Date(calc.createdAt).toLocaleDateString() : ''} • {calc.user?.name ?? ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/calculations/${calc.id}/edit`} className="flex items-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors text-sm">
              <Pencil className="w-4 h-4" />
              {t('common', 'edit')}
            </Link>
            <Link href={`/calculations/new?copyFrom=${calc.id}`} className="flex items-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors text-sm">
              <Copy className="w-4 h-4" />
              {t('common', 'copy')}
            </Link>
            <button onClick={handleExportPdf} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm">
              <FileDown className="w-4 h-4" />
              {t('common', 'exportPdf')}
            </button>
          </div>
        </div>

        {/* Parts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-700">{t('calculation', 'parts')}</h2>
          </div>
          <div className="divide-y">
            {(calc.parts ?? []).map((part: any, i: number) => (
              <div key={part.id ?? i} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">{part.partName ?? '-'}</p>
                  <p className="text-xs text-slate-400">{part.material?.name ?? '-'}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-600">{part.grossWeight ?? 0}g → {part.netWeight?.toFixed?.(2) ?? '0'}g (fire: {part.wasteRate ?? 0}%)</p>
                  <p className="font-semibold text-blue-600">{formatCurrency(part.cost ?? 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cost Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold mb-4">{t('calculation', 'summary')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-blue-200"><Package className="w-4 h-4" />{t('calculation', 'totalMaterialCost')}</span>
              <span className="font-medium">{formatCurrency(calc.totalMaterialCost ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-blue-200"><Wrench className="w-4 h-4" />{t('calculation', 'laborCostPerPair')} {calc.laborCurrency && calc.laborCurrency !== calc.currency ? `(${calc.laborCurrency})` : ''}</span>
              <span className="font-medium">{formatCurrency(calc.laborCostPerPair ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-blue-200"><Paintbrush className="w-4 h-4" />{t('calculation', 'paintCost')}</span>
              <span className="font-medium">{formatCurrency(calc.paintCost ?? 0)}</span>
            </div>
            <div className="border-t border-white/20 pt-3">
              <div className="flex justify-between text-lg">
                <span>{t('calculation', 'totalCost')}</span>
                <span className="font-bold">{formatCurrency(calc.totalCost ?? 0)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />{t('calculation', 'profitMargin')}</span>
              <span className="font-medium">{calc.profitMargin ?? 0}%</span>
            </div>
            <div className="flex justify-between text-xl pt-2 border-t border-white/20">
              <span>{t('calculation', 'sellingPrice')}</span>
              <span className="font-bold text-green-300">{formatCurrency(calc.sellingPrice ?? 0)}</span>
            </div>
            {(calc.vatRate ?? 0) > 0 && (
              <div className="flex justify-between text-xl bg-white/10 rounded-lg px-3 py-2">
                <span>{t('calculation', 'sellingPriceWithVat')} (KDV %{calc.vatRate})</span>
                <span className="font-bold text-yellow-300">{formatCurrency(calc.sellingPriceWithVat ?? 0)}</span>
              </div>
            )}
          </div>

          {/* Teklif Oluştur butonu */}
          <div className="mt-5 pt-4 border-t border-white/20">
            <Link
              href={`/quotes/new?calcId=${calc.id}`}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/15 hover:bg-white/25 text-white rounded-xl font-semibold transition-colors border border-white/30"
            >
              <FileText className="w-5 h-5" />
              Teklif Oluştur
            </Link>
          </div>
        </motion.div>

        {calc.notes && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-2">{t('calculation', 'notes')}</h3>
            <p className="text-slate-600 text-sm">{calc.notes}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
