'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDate } from '@/lib/time';
import {
  TrendingUp, TrendingDown, BarChart2, DollarSign,
  ScrollText, ChevronRight, Loader2, AlertCircle,
  Users, Package, FileText, Layers, ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import PendingOrdersWidget from '@/app/components/pending-orders-widget';
import { WidgetShell } from '@/app/components/widget-shell';
import {
  DndContext, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;

const ASSET_KEYS = ['kasa', 'pos', 'cek', 'senet', 'stok', 'acikHesap', 'calisanlar'];
const ASSET_COLORS: Record<string, string> = {
  kasa: '#22c55e', pos: '#22c55e', cek: '#22c55e', senet: '#4ade80',
  stok: '#22c55e', acikHesap: '#16a34a', calisanlar: '#86efac',
};
const CEK_DURUM_COLOR: Record<string, string> = {
  PORTFOY: 'bg-blue-100 text-blue-700',
  BANKAYA_VERILDI: 'bg-purple-100 text-purple-700',
};

const DEFAULT_ORDER = ['kpi', 'assets', 'checks', 'orders'];
const STORAGE_KEY = 'dashboard_layout_v1';

interface LayoutState {
  order: string[];
  collapsed: string[];
}

function loadLayout(): LayoutState {
  if (typeof window === 'undefined') return { order: DEFAULT_ORDER, collapsed: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all default widgets are present
      const order = [
        ...parsed.order.filter((id: string) => DEFAULT_ORDER.includes(id)),
        ...DEFAULT_ORDER.filter(id => !parsed.order.includes(id)),
      ];
      return { order, collapsed: parsed.collapsed ?? [] };
    }
  } catch {}
  return { order: DEFAULT_ORDER, collapsed: [] };
}

function saveLayout(layout: LayoutState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
}

// ── Widget content components (no outer card) ──────────────────────────────

function KpiContent({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {[
        { label: 'Toplam Alacak', value: fmt(data?.totalReceivables ?? 0), unit: 'TL', border: 'border-orange-400', bg: 'bg-orange-100', icon: TrendingUp, iconCls: 'text-orange-500' },
        { label: 'Toplam Borç', value: fmt(data?.totalPayables ?? 0), unit: 'TL', border: 'border-red-400', bg: 'bg-red-100', icon: TrendingDown, iconCls: 'text-red-500' },
        { label: 'Bugünkü Ciro', value: fmt(data?.dailyCiro ?? 0), unit: 'Bugün', border: 'border-blue-400', bg: 'bg-blue-100', icon: DollarSign, iconCls: 'text-blue-500' },
        { label: 'Aylık Ciro', value: fmt(data?.monthlyCiro ?? 0), unit: 'Bu ay', border: 'border-emerald-400', bg: 'bg-emerald-100', icon: BarChart2, iconCls: 'text-emerald-500' },
      ].map(k => (
        <div key={k.label} className={`rounded-xl border-l-4 ${k.border} bg-slate-50 p-3`}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-tight">{k.label}</p>
            <div className={`w-7 h-7 ${k.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <k.icon className={`w-3.5 h-3.5 ${k.iconCls}`} />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-800 tabular-nums">{k.value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{k.unit}</p>
        </div>
      ))}
    </div>
  );
}

function AssetsContent({ assets, t }: { assets: Record<string, number>; t: (s: string, k: string) => string }) {
  const ASSET_LABELS: Record<string, string> = {
    kasa: 'Kasa', pos: 'POS', cek: 'Çek', senet: 'Senet',
    stok: 'Stok',
    acikHesap: t('dashboard', 'assets') === 'ASSETS' ? 'Open Account' : 'Açık Hesap',
    calisanlar: t('dashboard', 'assets') === 'ASSETS' ? 'Employees' : 'Çalışanlar',
  };
  const total = ASSET_KEYS.reduce((s, k) => s + (assets[k] || 0), 0);
  return (
    <div className="p-5 space-y-3.5">
      {ASSET_KEYS.map(k => {
        const val = assets[k] || 0;
        const pct = total > 0 ? Math.max(2, (val / total) * 100) : 0;
        return (
          <div key={k}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-green-600">{ASSET_LABELS[k]}</span>
              <span className="text-sm text-slate-600 font-medium">{fmt(val)} TL</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `repeating-linear-gradient(45deg,${ASSET_COLORS[k]},${ASSET_COLORS[k]} 6px,${ASSET_COLORS[k]}cc 6px,${ASSET_COLORS[k]}cc 12px)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChecksContent({ checks, t }: { checks: any[]; t: (s: string, k: string) => string }) {
  const CEK_DURUM: Record<string, string> = {
    PORTFOY: t('dashboard', 'inPortfolio'),
    BANKAYA_VERILDI: t('dashboard', 'atBank'),
  };
  if (checks.length === 0) {
    return (
      <div className="py-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
        <ScrollText className="w-9 h-9 text-slate-200" />
        {t('dashboard', 'noUpcomingChecks')}
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-50">
      {checks.map(c => {
        const daysLeft = Math.ceil((new Date(c.vadesi).getTime() - Date.now()) / 86400000);
        return (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{c.borclu}</p>
              <p className="text-xs text-slate-400">
                {c.customer?.name && <span className="mr-2 text-blue-600">{c.customer.name}</span>}
                {t('dashboard', 'maturity')} {fmtDate(c.vadesi)}
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
                  {daysLeft}{t('dashboard', 'daysLeft')}
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
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<{ usd: number | null; eur: number | null; date: string | null }>({ usd: null, eur: null, date: null });
  const [layout, setLayout] = useState<LayoutState>({ order: DEFAULT_ORDER, collapsed: [] });

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json()).then(d => setData(d)).catch(console.error).finally(() => setLoading(false));
    fetch('/api/exchange-rates')
      .then(r => r.json()).then(d => { if (!d.error) setRates(d); }).catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout(prev => {
      const oldIdx = prev.order.indexOf(String(active.id));
      const newIdx = prev.order.indexOf(String(over.id));
      const next = { ...prev, order: arrayMove(prev.order, oldIdx, newIdx) };
      saveLayout(next);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setLayout(prev => {
      const collapsed = prev.collapsed.includes(id)
        ? prev.collapsed.filter(c => c !== id)
        : [...prev.collapsed, id];
      const next = { ...prev, collapsed };
      saveLayout(next);
      return next;
    });
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
  const assetTotal = ASSET_KEYS.reduce((s, k) => s + (assets[k] || 0), 0);

  const isEmpty =
    !data ||
    ((data.totalReceivables ?? 0) === 0 &&
     (data.totalPayables ?? 0) === 0 &&
     (data.monthlyCiro ?? 0) === 0 &&
     Object.values(assets).every((v: any) => v === 0));

  const widgetMap: Record<string, React.ReactNode> = {
    kpi: <KpiContent data={data} />,
    assets: <AssetsContent assets={assets} t={t} />,
    checks: <ChecksContent checks={upcomingChecks} t={t} />,
    orders: <PendingOrdersWidget embedded />,
  };

  const widgetMeta: Record<string, { title: string; icon: React.ReactNode; headerExtra?: React.ReactNode }> = {
    kpi: {
      title: 'Finansal Özet',
      icon: <BarChart2 className="w-4 h-4" />,
    },
    assets: {
      title: 'Varlıklar',
      icon: <TrendingUp className="w-4 h-4" />,
      headerExtra: (
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
          {fmt(assetTotal)} TL
        </span>
      ),
    },
    checks: {
      title: t('dashboard', 'upcomingChecks'),
      icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
      headerExtra: (
        <Link href="/cek-portfolyo" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
          {t('dashboard', 'viewAll')} <ChevronRight className="w-3 h-3" />
        </Link>
      ),
    },
    orders: {
      title: 'Bekleyen Siparişler',
      icon: <ClipboardList className="w-4 h-4 text-blue-500" />,
      headerExtra: (
        <Link href="/orders" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
          Tümünü Gör <ChevronRight className="w-3 h-3" />
        </Link>
      ),
    },
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {t('dashboard', 'welcomeUser')}, {user?.name ?? 'Kullanıcı'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{user?.companyName ?? ''}</p>
        </div>

        {/* Onboarding */}
        {isEmpty && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-blue-800 mb-3">Hesabınız hazır! Başlamak için aşağıdaki adımları takip edin:</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { href: '/customers', icon: Users, color: 'bg-blue-100 text-blue-600', label: 'Müşteri Ekle', desc: 'İlk müşterinizi ekleyin' },
                { href: '/materials', icon: Layers, color: 'bg-violet-100 text-violet-600', label: 'Hammadde Ekle', desc: 'Stok takibine başlayın' },
                { href: '/products', icon: Package, color: 'bg-emerald-100 text-emerald-600', label: 'Ürün Ekle', desc: 'Ürün kataloğunuzu oluşturun' },
                { href: '/invoices/new', icon: FileText, color: 'bg-orange-100 text-orange-600', label: 'Fatura Oluştur', desc: 'İlk faturanızı kesin' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-start gap-3 p-3 bg-white rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Exchange rates */}
        {(rates.usd || rates.eur) && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">
              TCMB Döviz Kuru{rates.date ? ` · ${new Date(rates.date).toLocaleDateString('tr-TR')}` : ''}:
            </span>
            {rates.usd && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-100 text-sm font-semibold text-slate-700">
                <span className="text-green-500 text-xs font-bold">$</span> 1 USD = {rates.usd.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} TL
              </span>
            )}
            {rates.eur && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-100 text-sm font-semibold text-slate-700">
                <span className="text-blue-500 text-xs font-bold">€</span> 1 EUR = {rates.eur.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} TL
              </span>
            )}
          </div>
        )}

        {/* Hint */}
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 text-center leading-none">⠿</span>
          Widget başlıklarındaki tutamaçtan sürükleyerek sıralayabilir, ok ikonuyla küçültebilirsiniz.
        </p>

        {/* Draggable widgets */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        >
          <SortableContext items={layout.order} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {layout.order.map(id => {
                const meta = widgetMeta[id];
                if (!meta) return null;
                return (
                  <WidgetShell
                    key={id}
                    id={id}
                    title={meta.title}
                    icon={meta.icon}
                    headerExtra={meta.headerExtra}
                    collapsed={layout.collapsed.includes(id)}
                    onToggle={() => toggleCollapse(id)}
                  >
                    {widgetMap[id]}
                  </WidgetShell>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </AppShell>
  );
}
