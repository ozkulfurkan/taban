'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Settings, Shield, Menu, X, ChevronLeft,
  FileText, Users, Truck, BoxIcon, Receipt, CreditCard, Package, Landmark, ScrollText, UserCog, Calculator, Globe, Factory
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/language-context';

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
  const hasFullAccess = isAdmin || isOwner;
  const allowedPages: string[] = user?.allowedPages ?? [];

  // Map href prefix → permission key (must match ALL_PAGES keys in settings/users)
  const PAGE_KEY: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/customers': 'customers',
    '/suppliers': 'suppliers',
    '/invoices': 'invoices',
    '/quotes': 'invoices',
    '/payments': 'payments',
    '/products': 'products',
    '/materials': 'materials',
    '/accounts': 'accounts',
    '/cek-portfolyo': 'cek-portfolyo',
    '/calculations': 'calculations',
    '/settings': 'settings',
    '/subcontractors': 'fason',
    '/subcontractor-orders': 'fason',
  };

  const canSee = (href: string) => {
    if (hasFullAccess) return true;
    const key = Object.entries(PAGE_KEY).find(([prefix]) => href.startsWith(prefix))?.[1];
    if (!key) return true;
    return allowedPages.includes(key);
  };

  const sections: Section[] = [
    {
      links: [
        { href: '/dashboard', label: t('nav', 'home'), icon: LayoutDashboard },
      ],
    },
    {
      title: t('nav', 'commercial'),
      links: [
        { href: '/customers', label: t('nav', 'customers'), icon: Users },
        { href: '/suppliers', label: t('nav', 'suppliers'), icon: Truck },
        { href: '/invoices', label: t('nav', 'sales'), icon: Receipt },
        { href: '/quotes/new', label: t('nav', 'quotes'), icon: FileText },
        { href: '/payments', label: t('nav', 'payments'), icon: CreditCard },
      ],
    },
    {
      title: t('nav', 'stock'),
      links: [
        { href: '/products', label: t('nav', 'products'), icon: BoxIcon },
        { href: '/materials', label: t('nav', 'rawMaterials'), icon: Package },
      ],
    },
    {
      title: t('nav', 'cashManagement'),
      links: [
        { href: '/accounts', label: t('nav', 'accounts'), icon: Landmark },
        { href: '/cek-portfolyo', label: t('nav', 'checkPortfolio'), icon: ScrollText },
      ],
    },
    {
      title: 'Fason',
      links: [
        { href: '/subcontractors', label: 'Fasoncular', icon: Factory },
        { href: '/subcontractor-orders', label: 'Fason Siparişleri', icon: Factory },
      ],
    },
    {
      title: 'Araçlar',
      links: [
        { href: '/products/new?from=maliyet', label: 'Maliyet Hesaplama', icon: Calculator, special: true },
      ],
    },
    {
      title: t('nav', 'system'),
      links: [
        { href: '/settings', label: t('nav', 'settings'), icon: Settings },
        ...(isAdmin || user?.role === 'COMPANY_OWNER' ? [{ href: '/settings/users', label: t('nav', 'users'), icon: UserCog }] : []),
        ...(isAdmin ? [{ href: '/admin', label: t('nav', 'admin'), icon: Shield }] : []),
        ...(isAdmin || isOwner ? [{ href: '/portal-admin', label: 'Müşteri Portalı', icon: Globe }] : []),
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/calculations/new') return pathname === href;
    if (href === '/quotes/new') return pathname === href || pathname?.startsWith('/quotes');
    if (href === '/products/new?from=maliyet') return pathname === '/products/new';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-blue-800/30">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">SC</div>
            <span className="text-white font-semibold text-lg">SoleCost</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-blue-300 hover:text-white transition-colors hidden lg:block"
        >
          <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => setMobileOpen(false)} className="text-blue-300 hover:text-white lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="text-xs text-blue-400/60 px-4 pt-4 pb-1 uppercase tracking-widest font-semibold">
                {section.title}
              </p>
            )}
            {section.title && collapsed && si > 0 && (
              <div className="mx-3 my-2 border-t border-blue-800/40" />
            )}
            <div className="px-2 space-y-0.5">
              {section.links.filter(link => canSee(link.href)).map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? link.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      link.special
                        ? active
                          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                          : 'text-amber-300 hover:bg-amber-500/20 hover:text-amber-200'
                        : active
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'text-blue-200 hover:bg-blue-800/50 hover:text-white'
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-blue-900 text-white p-2 rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed left-0 top-0 h-full w-[260px] bg-gradient-to-b from-blue-900 to-slate-900 z-50 lg:hidden shadow-2xl"
          >
            <NavContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block h-screen bg-gradient-to-b from-blue-900 to-slate-900 transition-all duration-300 flex-shrink-0 ${
          collapsed ? 'w-[68px]' : 'w-[250px]'
        }`}
      >
        <NavContent />
      </aside>
    </>
  );
}
