'use client';

import { useSession, signOut } from 'next-auth/react';
import { canSeePage } from '@/lib/access';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Settings, Shield, Menu, X, ChevronLeft,
  FileText, Users, Truck, BoxIcon, Receipt, Package, Landmark, ScrollText,
  UserCog, Calculator, Globe, Factory, ClipboardList, UserCheck, LifeBuoy, LogOut, Send
} from '@/app/components/icons';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/language-context';
import { BrandMark } from '@/app/components/brand-mark';

type LinkItem = { href: string; label: string; icon: any; special?: boolean };
type Section = { title?: string; links: LinkItem[] };

export default function Sidebar() {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();

  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'COMPANY_OWNER';
  const isMaterial = user?.companyType === 'MATERIAL_SUPPLIER';

  const canSee = (href: string) => canSeePage(user, href.split('?')[0]);

  const sections: Section[] = [
    {
      links: [
        { href: '/dashboard', label: t('nav', 'home'), icon: LayoutDashboard },
        ...(isMaterial
          ? [{ href: '/hesaplayici', label: t('nav', 'calculator'), icon: Calculator, special: true }]
          : [{ href: '/products/new?from=maliyet', label: t('nav', 'costCalc'), icon: Calculator, special: true }]
        ),
      ],
    },
    {
      title: t('nav', 'commercial'),
      links: [
        { href: '/customers', label: t('nav', 'customers'), icon: Users },
        { href: '/suppliers', label: t('nav', 'suppliers'), icon: Truck },
        { href: '/invoices', label: t('nav', 'sales'), icon: Receipt },
        { href: '/purchases', label: t('nav', 'purchases'), icon: Package },
      ],
    },
    {
      // Gelen: müşterilerden (portal, bağlı SoleCost firmaları, elle) gelen siparişler — hammaddeci dahil herkes
      // Verilen: bağlı SoleCost tedarikçilerine verilen siparişler
      title: t('nav', 'ordersSection'),
      links: [
        { href: '/orders', label: t('nav', 'incomingOrders'), icon: ClipboardList },
        { href: '/sevkiyat', label: t('nav', 'dispatch'), icon: Truck },
        { href: '/verilen-siparisler', label: t('nav', 'networkOrders'), icon: Send },
      ],
    },
    {
      title: t('nav', 'stockAccounts'),
      links: [
        { href: '/products', label: t('nav', 'products'), icon: BoxIcon },
        ...(!isMaterial ? [{ href: '/materials', label: t('nav', 'rawMaterials'), icon: Package }] : []),
        { href: '/accounts', label: t('nav', 'accounts'), icon: Landmark },
        { href: '/cek-portfolyo', label: t('nav', 'checkPortfolio'), icon: ScrollText },
      ],
    },
    {
      title: t('nav', 'operations'),
      links: [
        ...(!isMaterial ? [{ href: '/subcontractors', label: t('nav', 'subcontractors'), icon: Factory }] : []),
        ...(!isMaterial ? [{ href: '/subcontractor-orders', label: t('nav', 'subcontractorOrders'), icon: Factory }] : []),
        { href: '/personnel', label: t('nav', 'personnel'), icon: UserCheck },
        ...(isAdmin || isOwner ? [{ href: '/portal-admin', label: t('nav', 'customerPortal'), icon: Globe }] : []),
      ],
    },
    {
      title: t('nav', 'system'),
      links: [
        { href: '/settings', label: t('nav', 'settings'), icon: Settings },
        ...(isAdmin || isOwner ? [{ href: '/settings/users', label: t('nav', 'users'), icon: UserCog }] : []),
        ...(isAdmin ? [{ href: '/logs', label: t('nav', 'logs'), icon: ClipboardList }] : []),
        ...(isAdmin ? [{ href: '/admin/destek', label: t('nav', 'supportAdmin'), icon: LifeBuoy }] : []),
        ...(isAdmin ? [{ href: '/admin', label: t('nav', 'admin'), icon: Shield }] : []),
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/products/new?from=maliyet') return pathname === '/products/new';
    if (href === '/quotes/new') return pathname === href || pathname?.startsWith('/quotes');
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // Alt sekmeler (telefon): yalnız izinli sayfalar; kısıtlı profilde (usta, nakliyeci) kendi ekranları
  const bottomTabs = [
    { href: '/dashboard', label: t('nav', 'home'), icon: LayoutDashboard },
    { href: '/customers', label: t('nav', 'commercial'), icon: Users },
    { href: '/products', label: t('nav', 'mobileStock'), icon: BoxIcon },
    { href: '/accounts', label: t('nav', 'mobileAccounts'), icon: Landmark },
    { href: '/orders', label: t('nav', 'incomingOrders'), icon: ClipboardList },
    { href: '/verilen-siparisler', label: t('nav', 'networkOrders'), icon: Send },
    { href: '/sevkiyat', label: t('nav', 'dispatch'), icon: Truck },
  ].filter(tab => canSee(tab.href)).slice(0, 4);

  const NavLink = ({ link }: { link: LinkItem }) => {
    const Icon = link.icon;
    const active = isActive(link.href);
    return (
      <div className="relative group">
        <Link
          href={link.href}
          onClick={() => setMobileOpen(false)}
          aria-current={active ? 'page' : undefined}
          className={`relative flex items-center gap-3 px-3 py-[7px] rounded-md text-[13px] transition-colors duration-150 ${
            link.special
              ? active
                ? 'bg-brand-700 text-white font-medium shadow-card'
                : 'bg-brand-50 text-brand-700 font-medium ring-1 ring-inset ring-brand-100 hover:bg-brand-100'
              : active
                ? 'bg-brand-50/80 text-brand-800 font-semibold before:absolute before:left-[-8px] before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-brand-700'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          {Icon && <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active && !link.special ? 'text-brand-700' : ''}`} weight={active ? 'fill' : 'regular'} />}
          {!collapsed && <span>{link.label}</span>}
        </Link>
        {collapsed && (
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-ink-900 text-ink-50 text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
            {link.label}
          </span>
        )}
      </div>
    );
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 px-4 flex items-center justify-between">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <span className="font-display text-[22px] font-semibold text-ink-900 tracking-tight">SoleCost</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <BrandMark size={36} />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          className="text-ink-400 hover:text-ink-800 transition-colors hidden lg:block"
        >
          <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat" className="text-ink-400 hover:text-ink-800 lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <div className="mx-4 stitch text-ink-200" aria-hidden />
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-2">
        {sections.map((section, si) => {
          const visibleLinks = section.links.filter(link => canSee(link.href));
          if (visibleLinks.length === 0) return null;
          return (
            <div key={si}>
              {section.title && !collapsed && (
                <p className="section-title px-5 pt-4 pb-1.5 text-[10px]">
                  {section.title}
                </p>
              )}
              {section.title && collapsed && si > 0 && (
                <div className="mx-3 my-2 border-t border-ink-200" />
              )}
              <div className="px-3 space-y-px">
                {visibleLinks.map((link) => (
                  <NavLink key={link.href} link={link} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Logout — shown only in mobile drawer */}
      <div className="px-3 pb-3 border-t border-ink-200 pt-2 lg:hidden">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium text-red-700 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Çıkış Yap</span>
        </button>
      </div>

    </div>
  );

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur border-t border-ink-200 flex pb-[env(safe-area-inset-bottom)]">
        {bottomTabs.map(tab => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <tab.icon className="w-5 h-5" weight={active ? 'fill' : 'regular'} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex-1 flex flex-col items-center py-2 gap-0.5 text-[11px] font-medium text-ink-500 hover:text-ink-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span>{t('nav', 'menu')}</span>
        </button>
      </nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-950/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed left-0 top-0 h-full w-[268px] bg-[#FDFCFA] border-r border-ink-200 z-50 lg:hidden shadow-pop"
          >
            <NavContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        data-testid="sidebar"
        className={`hidden lg:block h-screen bg-[#FDFCFA] border-r border-ink-200 transition-all duration-300 flex-shrink-0 ${
          collapsed ? 'w-[68px]' : 'w-[250px]'
        }`}
      >
        <NavContent />
      </aside>
    </>
  );
}
