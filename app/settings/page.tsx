'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { Settings, Save, Loader2, Globe, DollarSign, User, Building2, CreditCard, Plus, Trash2, Image, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface BankEntry {
  bankName: string;
  iban: string;
  accountName: string;
}

export default function SettingsPage() {
  const { data: session, update } = useSession() || {};
  const { t, language, setLanguage, currency, setCurrency } = useLanguage();
  const user = session?.user as any;
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [lang, setLang] = useState(language);
  const [cur, setCur] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySuccess, setCompanySuccess] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [usdToTry, setUsdToTry] = useState('1');
  const [eurToTry, setEurToTry] = useState('1');
  const [tcmbLoading, setTcmbLoading] = useState(false);
  const [vatRate, setVatRate] = useState('20');
  const [logoUrl, setLogoUrl] = useState('');
  const [banks, setBanks] = useState<BankEntry[]>([]);
  const [companyLoading, setCompanyLoading] = useState(true);

  const canEditCompany = user?.role === 'ADMIN' || user?.role === 'COMPANY_OWNER';

  useEffect(() => {
    fetch('/api/company')
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setCompanyName(d.name ?? '');
          setCompanyAddress(d.address ?? '');
          setCompanyTaxId(d.taxId ?? '');
          setCompanyPhone(d.phone ?? '');
          setUsdToTry(String(d.usdToTry ?? 1));
          setEurToTry(String(d.eurToTry ?? 1));
          setVatRate(String(d.vatRate ?? 20));
          setLogoUrl(d.logoUrl ?? '');
          try {
            setBanks(d.bankInfo ? JSON.parse(d.bankInfo) : []);
          } catch {
            setBanks([]);
          }
        }
      })
      .catch(console.error)
      .finally(() => setCompanyLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, language: lang, currency: cur }),
      });
      if (res.ok) {
        setLanguage(lang as any);
        setCurrency(cur);
        await update?.({ language: lang, currency: cur });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setCompanySaving(true);
    setCompanySuccess(false);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          address: companyAddress,
          taxId: companyTaxId,
          phone: companyPhone,
          usdToTry,
          eurToTry,
          vatRate,
          logoUrl,
          bankInfo: JSON.stringify(banks),
        }),
      });
      if (res.ok) {
        setCompanySuccess(true);
        setTimeout(() => setCompanySuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompanySaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addBank = () => setBanks([...banks, { bankName: '', iban: '', accountName: '' }]);
  const removeBank = (i: number) => setBanks(banks.filter((_, idx) => idx !== i));
  const updateBank = (i: number, field: keyof BankEntry, val: string) =>
    setBanks(banks.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)));

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">{t('settings', 'title')}</h1>
        </div>

        {/* Profile */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-700">{t('settings', 'profile')}</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('common', 'name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth', 'email')}</label>
            <input value={user?.email ?? ''} disabled className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500" />
          </div>

          <div className="flex items-center gap-3 pb-2 pt-2 border-b">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-700">{t('settings', 'preferences')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('common', 'language')}</label>
              <select value={lang} onChange={(e) => setLang(e.target.value as 'tr' | 'en')} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('common', 'currency')}</label>
              <select value={cur} onChange={(e) => setCur(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
              </select>
            </div>
          </div>

          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
              ✓ {t('settings', 'updateSuccess')}
            </motion.div>
          )}

          <button onClick={handleSaveProfile} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-600/20">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {t('common', 'save')}
          </button>
        </motion.div>

        {/* Company Info */}
        {!companyLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-700">{t('settings', 'companyInfo')}</h2>
              {!canEditCompany && <span className="text-xs text-slate-400 ml-auto">(Sadece yöneticiler düzenleyebilir)</span>}
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings', 'logo')}</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-16 w-auto max-w-[160px] object-contain rounded border border-slate-200 p-1" />
                ) : (
                  <div className="h-16 w-24 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                    <Image className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={!canEditCompany}
                    className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('settings', 'uploadLogo')}
                  </button>
                  {logoUrl && (
                    <button onClick={() => setLogoUrl('')} disabled={!canEditCompany} className="px-3 py-1.5 text-sm border border-red-300 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50">
                      {t('settings', 'removeLogo')}
                    </button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth', 'companyName')}</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEditCompany} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings', 'companyPhone')}</label>
                <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} disabled={!canEditCompany} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings', 'companyAddress')}</label>
                <textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} disabled={!canEditCompany} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings', 'companyTaxId')}</label>
                <input value={companyTaxId} onChange={(e) => setCompanyTaxId(e.target.value)} disabled={!canEditCompany} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
            </div>

            {/* Exchange Rates */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <h3 className="font-medium text-slate-700">{t('settings', 'exchangeRates')}</h3>
                </div>
                {canEditCompany && (
                  <button
                    type="button"
                    disabled={tcmbLoading}
                    onClick={async () => {
                      setTcmbLoading(true);
                      try {
                        const d = await fetch('/api/exchange-rates').then(r => r.json());
                        if (d.usd) setUsdToTry(String(d.usd));
                        if (d.eur) setEurToTry(String(d.eur));
                      } finally { setTcmbLoading(false); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                  >
                    {tcmbLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    TCMB'den Al
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings', 'usdToTry')}</label>
                  <input type="number" step="0.01" value={usdToTry} onChange={(e) => setUsdToTry(e.target.value)} disabled={!canEditCompany} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings', 'eurToTry')}</label>
                  <input type="number" step="0.01" value={eurToTry} onChange={(e) => setEurToTry(e.target.value)} disabled={!canEditCompany} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
              </div>
            </div>

            {/* VAT */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings', 'vatRate')}</label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" min="0" max="100" value={vatRate} onChange={(e) => setVatRate(e.target.value)} disabled={!canEditCompany} className="w-32 px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            {/* Bank Info */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <h3 className="font-medium text-slate-700">{t('settings', 'bankInfo')}</h3>
                </div>
                {canEditCompany && (
                  <button onClick={addBank} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg">
                    <Plus className="w-4 h-4" /> {t('settings', 'addBank')}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {banks.map((bank, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500">#{i + 1}</span>
                      {canEditCompany && (
                        <button onClick={() => removeBank(i)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        placeholder={t('settings', 'bankName')}
                        value={bank.bankName}
                        onChange={(e) => updateBank(i, 'bankName', e.target.value)}
                        disabled={!canEditCompany}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-white disabled:text-slate-500"
                      />
                      <input
                        placeholder={t('settings', 'accountName')}
                        value={bank.accountName}
                        onChange={(e) => updateBank(i, 'accountName', e.target.value)}
                        disabled={!canEditCompany}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-white disabled:text-slate-500"
                      />
                      <input
                        placeholder={t('settings', 'iban')}
                        value={bank.iban}
                        onChange={(e) => updateBank(i, 'iban', e.target.value)}
                        disabled={!canEditCompany}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-white disabled:text-slate-500 font-mono"
                      />
                    </div>
                  </div>
                ))}
                {banks.length === 0 && <p className="text-sm text-slate-400 text-center py-2">Banka bilgisi eklenmemiş</p>}
              </div>
            </div>

            {companySuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
                ✓ {t('settings', 'updateSuccess')}
              </motion.div>
            )}

            {canEditCompany && (
              <button onClick={handleSaveCompany} disabled={companySaving} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-600/20">
                {companySaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {t('common', 'save')}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
