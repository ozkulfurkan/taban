'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '@/app/components/app-shell';
import { LinkRequests } from '@/app/components/network';
import { useLanguage } from '@/lib/i18n/language-context';
import { formatDate } from '@/lib/time';
import {
  TrendingUp, TrendingDown, BarChart2, DollarSign,
  ScrollText, ChevronRight, Loader2, AlertCircle,
  Users, Package, FileText, Layers, ClipboardList, AlertTriangle,
} from '@/app/components/icons';
import Link from 'next/link';
import PendingOrdersWidget from '@/app/components/pending-orders-widget';
import { WidgetShell, SortablePairShell } from '@/app/components/widget-shell';
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
import FitText from '@/app/components/fit-text';

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = formatDate;

const ASSET_KEYS = ['kasa', 'pos', 'cek', 'senet', 'stok', 'acikHesap', 'calisanlar'];
// Varlık çubukları: marka bordosunun tonları (en büyük kalemler koyu, küçükler açık)
const ASSET_COLORS: Record<string, string> = {
  kasa: '#6B1A2C', pos: '#8A2438', cek: '#A8455A', senet: '#C66E7E',
  stok: '#561524', acikHesap: '#776D62', calisanlar: '#A89E92',
};
const CEK_DURUM_COLOR: Record<string, string> = {
  PORTFOY: 'bg-brand-100 text-brand-800',
  BANKAYA_VERILDI: 'bg-brand-100 text-brand-800',
};

const DEFAULT_ORDER = ['kpi', 'pair', 'orders'];
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
        { label: 'Toplam Alacak', value: fmt(data?.totalReceivables ?? 0), unit: 'TL', icon: TrendingUp, accent: true },
        { label: 'Toplam Borç', value: fmt(data?.totalPayables ?? 0), unit: 'TL', icon: TrendingDown },
        { label: 'Bugünkü Ciro', value: fmt(data?.dailyCiro ?? 0), unit: 'Bugün', icon: DollarSign },
        { label: 'Aylık Ciro', value: fmt(data?.monthlyCiro ?? 0), unit: 'Bu ay', icon: BarChart2 },
      ].map(k => (
        <div key={k.label} className={`rounded-lg p-4 ${k.accent ? 'bg-brand-700 text-white' : 'bg-ink-50 ring-1 ring-inset ring-ink-200/70'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${k.accent ? 'text-white/75' : 'text-ink-500'}`}>{k.label}</p>
            <k.icon className={`w-4 h-4 ${k.accent ? 'text-white/70' : 'text-ink-400'}`} />
          </div>
          <FitText className={`mt-3 font-display text-[1.65rem] leading-none tabular-nums ${k.accent ? 'text-white' : 'text-ink-900'}`}>{k.value}</FitText>
          <p className={`text-xs mt-1.5 ${k.accent ? 'text-white/65' : 'text-ink-500'}`}>{k.unit}</p>
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
              <span className="text-sm font-medium text-ink-800">{ASSET_LABELS[k]}</span>
              <span className="text-sm text-ink-700 font-medium tabular-nums">{fmt(val)} TL</span>
            </div>
            <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: ASSET_COLORS[k],
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
      <div className="py-10 text-center text-ink-400 text-sm flex flex-col items-center gap-2">
        <ScrollText className="w-9 h-9 text-ink-200" />
        {t('dashboard', 'noUpcomingChecks')}
      </div>
    );
  }
  return (
    <div className="divide-y divide-ink-50">
      {checks.map(c => {
        const daysLeft = Math.ceil((new Date(c.vadesi).getTime() - Date.now()) / 86400000);
        return (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-ink-50/50 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-800 truncate">{c.borclu}</p>
              <p className="text-xs text-ink-400">
                {c.customer?.name && <span className="mr-2 text-brand-700">{c.customer.name}</span>}
                {t('dashboard', 'maturity')} {fmtDate(c.vadesi)}
                {c.seriNo && <span className="ml-2 text-ink-400">({c.seriNo})</span>}
              </p>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-sm font-semibold text-ink-800">{fmt(c.tutar)} TL</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  daysLeft <= 7 ? 'bg-red-100 text-red-700' :
                  daysLeft <= 14 ? 'bg-amber-100 text-amber-700' :
                  'bg-brand-100 text-brand-800'
                }`}>
                  {daysLeft}{t('dashboard', 'daysLeft')}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${CEK_DURUM_COLOR[c.durum] || 'bg-ink-100 text-ink-600'}`}>
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
  const [savedRates, setSavedRates] = useState<{ usd: number | null; eur: number | null } | null>(null);
  const [layout, setLayout] = useState<LayoutState>({ order: DEFAULT_ORDER, collapsed: [] });

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json()).then(d => setData(d)).catch(console.error).finally(() => setLoading(false));
    // TCMB'ye ulaşılamazsa hesaplamalar ayarlardaki kayıtlı kurla yapılır; kullanıcıya gösterilir
    fetch('/api/exchange-rates')
      .then(r => r.json())
      .then(d => { if (d && !d.error && (d.usd || d.eur)) setRates(d); else throw new Error(); })
      .catch(() => {
        fetch('/api/company').then(r => r.json())
          .then(c => setSavedRates({ usd: c?.usdToTry ?? null, eur: c?.eurToTry ?? null }))
          .catch(() => setSavedRates({ usd: null, eur: null }));
      });
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
          <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
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

  const singleWidgets: Record<string, { title: string; icon: React.ReactNode; headerExtra?: React.ReactNode; content: React.ReactNode }> = {
    kpi: {
      title: 'Finansal Özet',
      icon: <BarChart2 className="w-4 h-4" />,
      content: <KpiContent data={data} />,
    },
    orders: {
      title: 'Bekleyen Siparişler',
      icon: <ClipboardList className="w-4 h-4 text-brand-600" />,
      headerExtra: (
        <Link href="/orders" className="text-xs text-brand-700 hover:underline flex items-center gap-0.5">
          Tümünü Gör <ChevronRight className="w-3 h-3" />
        </Link>
      ),
      content: <PendingOrdersWidget embedded />,
    },
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Welcome */}
        <div>
          <p className="section-title">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="page-title mt-1.5">
            {t('dashboard', 'welcomeUser')}, {user?.name ?? 'Kullanıcı'}
          </h1>
          <p className="page-subtitle">{user?.companyName ?? ''}</p>
        </div>

        <LinkRequests />

        {/* Onboarding */}
        {isEmpty && (
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-brand-900 mb-3">Hesabınız hazır! Başlamak için aşağıdaki adımları takip edin:</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { href: '/customers', icon: Users, color: 'bg-brand-100 text-brand-700', label: 'Müşteri Ekle', desc: 'İlk müşterinizi ekleyin' },
                { href: '/materials', icon: Layers, color: 'bg-brand-100 text-brand-700', label: 'Hammadde Ekle', desc: 'Stok takibine başlayın' },
                { href: '/products', icon: Package, color: 'bg-emerald-100 text-emerald-600', label: 'Ürün Ekle', desc: 'Ürün kataloğunuzu oluşturun' },
                { href: '/invoices/new', icon: FileText, color: 'bg-amber-100 text-amber-600', label: 'Fatura Oluştur', desc: 'İlk faturanızı kesin' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-start gap-3 p-3 bg-white rounded-xl border border-brand-100 hover:border-brand-300 hover:shadow-card transition-all">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{item.label}</p>
                    <p className="text-xs text-ink-400">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Eksi stok uyarısı */}
        {(data?.negativeStock?.materials?.length > 0 || data?.negativeStock?.products?.length > 0) && (
          <div role="status" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 space-y-2">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Eksi stokta kalemler var. Satışlar stoktan fazla yapılmış olabilir; stok düzeltmesi ya da alış girin.
            </p>
            <div className="flex flex-wrap gap-2 pl-6">
              {data.negativeStock.products.map((p: any) => (
                <Link key={p.id} href={`/products/${p.id}`} className="px-2.5 py-1 rounded-lg bg-white border border-red-200 hover:bg-red-100">
                  {p.code ? `${p.code} · ` : ''}{p.name}: <b>{p.stock.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {p.unit}</b>
                </Link>
              ))}
              {data.negativeStock.materials.map((m: any) => (
                <Link key={m.id} href={`/materials/${m.id}`} className="px-2.5 py-1 rounded-lg bg-white border border-red-200 hover:bg-red-100">
                  {m.name}: <b>{m.stock.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg</b>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Kur alınamadı uyarısı */}
        {savedRates && (
          <div role="status" className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Güncel TCMB kuru şu an alınamadı. Hesaplamalarda ayarlardaki kayıtlı kur kullanılıyor
              {savedRates.usd ? <>: <b>1 USD = {savedRates.usd.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</b></> : null}
              {savedRates.eur ? <>, <b>1 EUR = {savedRates.eur.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</b></> : null}.
              {' '}Kuru <Link href="/settings" className="underline">Ayarlar</Link> sayfasından güncelleyebilirsiniz.
            </span>
          </div>
        )}

        {/* Exchange rates */}
        {(rates.usd || rates.eur) && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-ink-400 font-medium">
              TCMB Döviz Kuru{rates.date ? ` · ${new Date(rates.date).toLocaleDateString('tr-TR')}` : ''}:
            </span>
            {rates.usd && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-ink-100 text-sm font-semibold text-ink-700">
                <span className="text-ink-400 text-xs font-bold">$</span> 1 USD = {rates.usd.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} TL
              </span>
            )}
            {rates.eur && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-ink-100 text-sm font-semibold text-ink-700">
                <span className="text-brand-600 text-xs font-bold">€</span> 1 EUR = {rates.eur.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} TL
              </span>
            )}
          </div>
        )}

        {/* Hint */}
        <p className="text-xs text-ink-400 flex items-center gap-1.5">
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
                if (id === 'pair') {
                  return (
                    <SortablePairShell
                      key="pair"
                      id="pair"
                      left={{
                        title: 'Varlıklar',
                        icon: <TrendingUp className="w-4 h-4" />,
                        headerExtra: (
                          <span className="text-xs font-semibold text-ink-600 bg-ink-100 px-2 py-0.5 rounded-full tabular-nums">
                            {fmt(assetTotal)} TL
                          </span>
                        ),
                        collapsed: layout.collapsed.includes('assets'),
                        onToggle: () => toggleCollapse('assets'),
                        children: <AssetsContent assets={assets} t={t} />,
                      }}
                      right={{
                        title: t('dashboard', 'upcomingChecks'),
                        icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
                        headerExtra: (
                          <Link href="/cek-portfolyo" className="text-xs text-brand-700 hover:underline flex items-center gap-0.5">
                            {t('dashboard', 'viewAll')} <ChevronRight className="w-3 h-3" />
                          </Link>
                        ),
                        collapsed: layout.collapsed.includes('checks'),
                        onToggle: () => toggleCollapse('checks'),
                        children: <ChecksContent checks={upcomingChecks} t={t} />,
                      }}
                    />
                  );
                }
                const w = singleWidgets[id];
                if (!w) return null;
                return (
                  <WidgetShell
                    key={id}
                    id={id}
                    title={w.title}
                    icon={w.icon}
                    headerExtra={w.headerExtra}
                    collapsed={layout.collapsed.includes(id)}
                    onToggle={() => toggleCollapse(id)}
                  >
                    {w.content}
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
