'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Calculator, Plus, Trash2, Loader2, Save, ChevronDown, ChevronUp, Paintbrush, Wrench, History } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface PartForm {
  partName: string;
  materialId: string;
  grossWeight: string;
  wasteRate: string;
}

function NewCalculationForm() {
  const { t, formatCurrency, currency } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');

  const [materials, setMaterials] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('parts');
  const [companyVatRate, setCompanyVatRate] = useState('20');

  const [name, setName] = useState('');
  const [parts, setParts] = useState<PartForm[]>([{ partName: '', materialId: '', grossWeight: '', wasteRate: '5' }]);
  const [laborMethod, setLaborMethod] = useState<'direct' | 'salary'>('direct');
  const [laborCurrency, setLaborCurrency] = useState(currency);
  const [monthlySalary, setMonthlySalary] = useState('');
  const [workDays, setWorkDays] = useState('26');
  const [dailyProduction, setDailyProduction] = useState('');
  const [laborCostPerPair, setLaborCostPerPair] = useState('');
  const [paintCost, setPaintCost] = useState('');
  const [profitMargin, setProfitMargin] = useState('20');
  const [vatRate, setVatRate] = useState('20');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/materials')
      .then((r) => r.json())
      .then((d) => setMaterials(Array.isArray(d) ? d : []))
      .catch(console.error);

    fetch('/api/company')
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setCompanyVatRate(String(d.vatRate ?? 20));
          setVatRate(String(d.vatRate ?? 20));
        }
      })
      .catch(console.error);
  }, []);

  // Load copy data if copyFrom is set
  useEffect(() => {
    if (!copyFromId) return;
    fetch(`/api/calculations/${copyFromId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setName(`${d.name} (Kopya)`);
          setParts(
            (d.parts ?? []).map((p: any) => ({
              partName: p.partName ?? '',
              materialId: p.materialId ?? '',
              grossWeight: String(p.grossWeight ?? ''),
              wasteRate: String(p.wasteRate ?? '5'),
            }))
          );
          setLaborMethod(d.laborMethod ?? 'direct');
          setLaborCurrency(d.laborCurrency ?? currency);
          setMonthlySalary(d.monthlySalary ? String(d.monthlySalary) : '');
          setWorkDays(d.workDays ? String(d.workDays) : '26');
          setDailyProduction(d.dailyProduction ? String(d.dailyProduction) : '');
          setLaborCostPerPair(d.laborCostPerPair ? String(d.laborCostPerPair) : '');
          setPaintCost(d.paintCost ? String(d.paintCost) : '');
          setProfitMargin(String(d.profitMargin ?? 20));
          setVatRate(String(d.vatRate ?? 20));
          setNotes(d.notes ?? '');
        }
      })
      .catch(console.error);
  }, [copyFromId]);

  const addPart = () => setParts([...parts, { partName: '', materialId: '', grossWeight: '', wasteRate: '5' }]);
  const removePart = (idx: number) => setParts(parts.filter((_, i) => i !== idx));
  const updatePart = (idx: number, field: string, value: string) =>
    setParts(parts.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));

  const calcPartCost = (part: PartForm) => {
    const mat = materials.find((m: any) => m.id === part.materialId);
    if (!mat || !part.grossWeight) return { netWeight: 0, cost: 0 };
    const gw = parseFloat(part.grossWeight) || 0;
    const wr = parseFloat(part.wasteRate) || 0;
    const netWeight = gw * (1 + wr / 100);
    const cost = (netWeight / 1000) * (mat.pricePerKg ?? 0);
    return { netWeight, cost };
  };

  const totalMaterialCost = parts.reduce((sum, p) => sum + calcPartCost(p).cost, 0);

  const calcLaborCost = () => {
    if (laborMethod === 'salary') {
      const ms = parseFloat(monthlySalary) || 0;
      const wd = parseFloat(workDays) || 1;
      const dp = parseFloat(dailyProduction) || 1;
      return ms / (wd * dp);
    }
    return parseFloat(laborCostPerPair) || 0;
  };

  const laborCost = calcLaborCost();
  const paintCostVal = parseFloat(paintCost) || 0;
  const totalCost = totalMaterialCost + laborCost + paintCostVal;
  const pm = parseFloat(profitMargin) || 0;
  const sellingPrice = pm >= 100 ? totalCost * 2 : totalCost / (1 - pm / 100);
  const vat = parseFloat(vatRate) || 0;
  const sellingPriceWithVat = sellingPrice * (1 + vat / 100);

  const handleSubmit = async () => {
    if (!name || !parts.some((p) => p.materialId && p.grossWeight)) return;
    setSaving(true);
    try {
      const body = {
        name,
        parts: parts.filter((p) => p.materialId && p.grossWeight).map((p) => ({
          partName: p.partName || 'Part',
          materialId: p.materialId,
          grossWeight: parseFloat(p.grossWeight) || 0,
          wasteRate: parseFloat(p.wasteRate) || 0,
        })),
        laborMethod,
        laborCurrency,
        monthlySalary: parseFloat(monthlySalary) || 0,
        workDays: parseInt(workDays) || 26,
        dailyProduction: parseInt(dailyProduction) || 0,
        laborCostPerPair: parseFloat(laborCostPerPair) || 0,
        paintCost: paintCostVal,
        profitMargin: pm,
        vatRate: vat,
        currency,
        notes,
      };
      const res = await fetch('/api/calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/calculations/${data.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: any }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-slate-700">{title}</span>
      </div>
      {expandedSection === id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
    </button>
  );

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {copyFromId ? t('calculation', 'copyCalculation') : t('common', 'newCalculation')}
            </h1>
            <p className="text-slate-500 text-sm">{t('calculation', 'title')}</p>
          </div>
          <Link
            href="/calculations"
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4" /> Hesaplama Geçmişi
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'calculationName')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={t('calculation', 'calculationName')}
          />
        </div>

        {/* Parts Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <SectionHeader id="parts" title={t('calculation', 'parts')} icon={Calculator} />
          <AnimatePresence>
            {expandedSection === 'parts' && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-5 space-y-4">
                  {parts.map((part, idx) => {
                    const { netWeight, cost } = calcPartCost(part);
                    return (
                      <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-slate-50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">#{idx + 1}</span>
                          {parts.length > 1 && (
                            <button onClick={() => removePart(idx)} className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('calculation', 'partName')}</label>
                            <input value={part.partName} onChange={(e) => updatePart(idx, 'partName', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('calculation', 'material')}</label>
                            <select value={part.materialId} onChange={(e) => updatePart(idx, 'materialId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                              <option value="">{t('calculation', 'material')}...</option>
                              {materials.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.name} ({formatCurrency(m.pricePerKg ?? 0)}/kg)</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('calculation', 'grossWeight')}</label>
                            <input type="number" step="0.1" value={part.grossWeight} onChange={(e) => updatePart(idx, 'grossWeight', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('calculation', 'wasteRate')}</label>
                            <input type="number" step="0.1" value={part.wasteRate} onChange={(e) => updatePart(idx, 'wasteRate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 pt-1">
                          <span>{t('calculation', 'netWeight')}: {netWeight.toFixed(2)}g</span>
                          <span className="font-semibold text-blue-600">{t('calculation', 'materialCost')}: {formatCurrency(cost)}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                  <button onClick={addPart} className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4" /> {t('calculation', 'addPart')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Labor Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <SectionHeader id="labor" title={t('calculation', 'labor')} icon={Wrench} />
          <AnimatePresence>
            {expandedSection === 'labor' && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-5 space-y-4">
                  {/* Labor Currency */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'laborCurrency')}</label>
                    <select value={laborCurrency} onChange={(e) => setLaborCurrency(e.target.value)} className="w-full sm:w-48 px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="TRY">TRY (₺)</option>
                    </select>
                    {laborCurrency !== currency && (
                      <p className="text-xs text-amber-600 mt-1">İşçilik maliyeti {laborCurrency} → {currency} kuruna göre dönüştürülecek</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setLaborMethod('direct')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${laborMethod === 'direct' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {t('calculation', 'directEntry')}
                    </button>
                    <button onClick={() => setLaborMethod('salary')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${laborMethod === 'salary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {t('calculation', 'salaryBased')}
                    </button>
                  </div>
                  {laborMethod === 'direct' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'laborCostPerPair')} ({laborCurrency})</label>
                      <input type="number" step="0.01" value={laborCostPerPair} onChange={(e) => setLaborCostPerPair(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'monthlySalary')} ({laborCurrency})</label>
                        <input type="number" step="0.01" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'workDays')}</label>
                        <input type="number" value={workDays} onChange={(e) => setWorkDays(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'dailyProduction')}</label>
                        <input type="number" value={dailyProduction} onChange={(e) => setDailyProduction(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                  )}
                  <div className="text-right text-sm">
                    <span className="text-slate-500">{t('calculation', 'laborCostPerPair')}: </span>
                    <span className="font-semibold text-blue-600">{laborCost.toFixed(4)} {laborCurrency}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Paint Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <SectionHeader id="paint" title={t('calculation', 'paint')} icon={Paintbrush} />
          <AnimatePresence>
            {expandedSection === 'paint' && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-5">
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'paintCost')}</label>
                  <input type="number" step="0.01" value={paintCost} onChange={(e) => setPaintCost(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold mb-4">{t('calculation', 'summary')}</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-200">{t('calculation', 'totalMaterialCost')}:</span>
              <span className="font-medium">{formatCurrency(totalMaterialCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">{t('calculation', 'laborCostPerPair')}:</span>
              <span className="font-medium">{formatCurrency(laborCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">{t('calculation', 'paintCost')}:</span>
              <span className="font-medium">{formatCurrency(paintCostVal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">{t('calculation', 'profitMargin')}:</span>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={profitMargin} onChange={(e) => setProfitMargin(e.target.value)} className="w-16 px-2 py-1 bg-white/20 rounded text-white text-right text-sm outline-none" />
                <span>%</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
            <div className="flex justify-between text-lg">
              <span>{t('calculation', 'totalCost')}:</span>
              <span className="font-bold">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('calculation', 'sellingPrice')}:</span>
              <span className="font-bold text-green-300">{formatCurrency(sellingPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>{t('calculation', 'vatRate')}:</span>
                <input type="number" step="0.1" min="0" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-14 px-2 py-1 bg-white/20 rounded text-white text-right text-sm outline-none" />
                <span>%</span>
              </div>
            </div>
            {vat > 0 && (
              <div className="flex justify-between text-lg border-t border-white/20 pt-2">
                <span>{t('calculation', 'sellingPriceWithVat')}:</span>
                <span className="font-bold text-yellow-300">{formatCurrency(sellingPriceWithVat)}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('calculation', 'notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || !name}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-600/20"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {t('common', 'save')}
        </button>
      </div>
    </AppShell>
  );
}

export default function NewCalculationPage() {
  return (
    <Suspense>
      <NewCalculationForm />
    </Suspense>
  );
}
