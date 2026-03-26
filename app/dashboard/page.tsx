'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import {
  TrendingUp, TrendingDown, BarChart2, DollarSign,
  ScrollText, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR');
const fmtShort = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('tr-TR', { minimumFractionDigits: 1 }) + 'M';
  if (n >= 1_000) return (n / 1_000).toLocaleString('tr-TR', { minimumFractionDigits: 1 }) + 'B';
  return fmt(n);
};

const ASSET_LABELS: Record<string, string> = {
  kasa: 'Kasa', pos: 'POS', cek: 'Çek', senet: 'Senet',
  stok: 'Stok', acikHesap: 'Açık Hesap', calisanlar: 'Çalışanlar',
};

const ASSET_COLORS: Record<string, string> = {
  kasa: '#22c55e', pos: '#22c55e', cek: '#22c55e', senet: '#4ade80',
  stok: '#22c55e', acikHesap: '#16a34a', calisanlar: '#86efac',
};

const CEK_DURUM: Record<string, string> = {
  PORTFOY: 'Portföyde',
  BANKAYA_VERILDI: 'Bankada',
};
const CEK_DURUM_COLOR: Record<string, string> = {
  PORTFOY: 'bg-blue-100 text-blue-700',
  BANKAYA_VERILDI: 'bg-purple-100 text-purple-700',
};

function AssetsPanel({ assets }: { assets: Record<string, number> }) {
  const KEYS = ['kasa', 'pos', 'cek', 'senet', 'stok', 'acikHesap', 'calisanlar'];
  const total = KEYS.reduce((s, k) => s + (assets[k] || 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="font-bold text-slate-800">VARLIKLAR</h2>
        <span className="font-bold text-slate-700 text-sm">{fmt(total)} TL</span>
      </div>
      <div className="p-5 space-y-4">
        {KEYS.map(k => {
          const val = assets[k] || 0;
          const pct = total > 0 ? Math.max(2, (val / total) * 100) : 0;
          return (
            <div key={k}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-green-600">{ASSET_LABELS[k]}</span>
                <span className="text-sm text-slate-600 font-medium">{fmt(val)} TL</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `repeating-linear-gradient(
                      45deg,
                      ${ASSET_COLORS[k]},
                      ${ASSET_COLORS[k]} 6px,
                      ${ASSET_COLORS[k]}cc 6px,
                      ${ASSET_COLORS[k]}cc 12px
                    )`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const user = session?.user as any;

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  const assets = data?.assets || {};
  const upcomingChecks: any[] = data?.upcomingChecks || [];

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Hoş geldin, {user?.name ?? 'Kullanıcı'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{user?.companyName ?? ''}</p>
        </div>

        {/* Top KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-400">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Toplam Alacak</p>
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-800">{fmtShort(data?.totalReceivables ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-0.5">TL</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-400">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Toplam Borç</p>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-800">{fmtShort(data?.totalPayables ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-0.5">TL</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-400">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Günlük Ciro</p>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-800">{fmtShort(data?.dailyCiro ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Bugün</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-emerald-400">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Aylık Ciro</p>
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-800">{fmtShort(data?.monthlyCiro ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Bu ay</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Assets Panel */}
          <AssetsPanel assets={assets} />

          {/* Upcoming Checks */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h2 className="font-bold text-slate-800">Son 1 Ayda Vadesi Gelen Çekler</h2>
              </div>
              <Link href="/cek-portfolyo" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Tümü <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {upcomingChecks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <ScrollText className="w-10 h-10 text-slate-200" />
                Son 1 ay içinde vadesi gelen çek yok
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {upcomingChecks.map(c => {
                  const daysLeft = Math.ceil((new Date(c.vadesi).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.borclu}</p>
                        <p className="text-xs text-slate-400">
                          {c.customer?.name && <span className="mr-2 text-blue-600">{c.customer.name}</span>}
                          Vade: {fmtDate(c.vadesi)}
                          {c.seriNo && <span className="ml-2 text-slate-400">({c.seriNo})</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-slate-800">{fmt(c.tutar)} TL</p>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                            daysLeft <= 7 ? 'bg-red-100 text-red-700' :
                            daysLeft <= 14 ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {daysLeft}g
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${CEK_DURUM_COLOR[c.durum] || 'bg-slate-100 text-slate-600'}`}>
                            {CEK_DURUM[c.durum] || c.durum}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
