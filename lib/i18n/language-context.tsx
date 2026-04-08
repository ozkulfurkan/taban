'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (section: string, key: string) => string;
  currency: string;
  setCurrency: (c: string) => void;
  formatCurrency: (amount: number) => string;
  formatAmount: (amount: number, currency: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('tr');
  const [currency, setCurrency] = useState<string>('USD');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('app-language') : null;
    if (stored === 'en' || stored === 'tr') setLanguage(stored);
    const storedCur = typeof window !== 'undefined' ? localStorage.getItem('app-currency') : null;
    if (storedCur) setCurrency(storedCur);
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') localStorage.setItem('app-language', lang);
  }, []);

  const handleSetCurrency = useCallback((c: string) => {
    setCurrency(c);
    if (typeof window !== 'undefined') localStorage.setItem('app-currency', c);
  }, []);

  const t = useCallback((section: string, key: string): string => {
    const trans = translations[language] as any;
    return trans?.[section]?.[key] ?? key;
  }, [language]);

  const formatCurrency = useCallback((amount: number): string => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
    const symbol = symbols[currency] ?? currency;
    return `${symbol}${(amount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currency]);

  const formatAmount = useCallback((amount: number, cur: string): string => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
    const symbol = symbols[cur] ?? cur;
    return `${symbol}${(amount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t, currency, setCurrency: handleSetCurrency, formatCurrency, formatAmount }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
}
