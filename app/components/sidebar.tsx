'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Settings, Shield, Menu, X, ChevronLeft,
  FileText, Users, Truck, BoxIcon, Receipt, CreditCard, Package, Landmark, ScrollText,
  UserCog, Calculator, Globe, Factory, ClipboardList, UserCheck, LifeBuoy
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
  const isMaterial = user?.companyType === 'MATERIAL_SUPPLIER';

  const PAGE_KEY: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/customers': 'customers',
    '/suppliers': 'suppliers',
    '/invoices': 'invoices',
    '/payments': 'payments',
    '/products': 'products',
    '/materials': 'materials',
    '/accounts': 'accounts',
    '/cek-portfolyo': 'cek-portfolyo',
    '/calculations': 'calculations',
    '/settings': 'settings',
    '/subcontractors': 'fason',
    '/subcontractor-orders': 'fason',
    '/personnel': 'personnel',
    '/orders': 'orders',
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
        ...(isMaterial
          ? [{ href: '/hesaplayici', label: 'Hesaplayıcı', icon: Calculator, special: true }]
          : [{ href: '/products/new?from=maliyet', label: 'Maliyet Hesaplama', icon: Calculator, special: true }]
        ),
      ],
    },
    {
      title: t('nav', 'commercial'),
      links: [
        { href: '/customers', label: t('nav', 'customers'), icon: Users },
        { href: '/suppliers', label: t('nav', 'suppliers'), icon: Truck },
        { href: '/invoices', label: t('nav', 'sales'), icon: Receipt },
        { href: '/purchases', label: 'Alışlar', icon: Package },
        { href: '/payments', label: t('nav', 'payments'), icon: CreditCard },
      ],
    },
    {
      title: 'Stok & Hesaplar',
      links: [
        { href: '/products', label: t('nav', 'products'), icon: BoxIcon },
        ...(!isMaterial ? [{ href: '/materials', label: t('nav', 'rawMaterials'), icon: Package }] : []),
        { href: '/accounts', label: t('nav', 'accounts'), icon: Landmark },
        { href: '/cek-portfolyo', label: t('nav', 'checkPortfolio'), icon: ScrollText },
      ],
    },
    {
      title: 'Operasyonlar',
      links: [
        ...(!isMaterial ? [{ href: '/orders', label: 'Siparişler', icon: ClipboardList }] : []),
        ...(!isMaterial ? [{ href: '/subcontractors', label: 'Fasoncular', icon: Factory }] : []),
        ...(!isMaterial ? [{ href: '/subcontractor-orders', label: 'Fason Siparişleri', icon: Factory }] : []),
        { href: '/personnel', label: 'Personel Takip', icon: UserCheck },
        { href: '/destek-merkezi', label: 'Destek Merkezi', icon: LifeBuoy },
        ...(isAdmin || isOwner ? [{ href: '/portal-admin', label: 'Müşteri Portalı', icon: Globe }] : []),
      ],
    },
    {
      title: t('nav', 'system'),
      links: [
        { href: '/settings', label: t('nav', 'settings'), icon: Settings },
        ...(isAdmin || isOwner ? [{ href: '/settings/users', label: t('nav', 'users'), icon: UserCog }] : []),
        ...(isAdmin ? [{ href: '/logs', label: 'Log Kayıtları', icon: ClipboardList }] : []),
        ...(isAdmin ? [{ href: '/admin/destek', label: 'Destek Yönetimi', icon: LifeBuoy }] : []),
        ...(isAdmin ? [{ href: '/admin', label: t('nav', 'admin'), icon: Shield }] : []),
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/products/new?from=maliyet') return pathname === '/products/new';
    if (href === '/quotes/new') return pathname === href || pathname?.startsWith('/quotes');
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const bottomTabs = [
    { href: '/dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
    { href: '/customers', label: 'Ticari', icon: Users },
    { href: '/products', label: 'Stok', icon: BoxIcon },
    { href: '/accounts', label: 'Hesaplar', icon: Landmark },
  ];

  const NavLink = ({ link }: { link: LinkItem }) => {
    const Icon = link.icon;
    const active = isActive(link.href);
    return (
      <div className="relative group">
        <Link
          href={link.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
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
        {collapsed && (
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
            {link.label}
          </span>
        )}
      </div>
    );
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-blue-800/30">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">SC</div>
            <span className="text-white font-semibold text-lg">SoleCost</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">SC</div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-blue-300 hover:text-white transition-colors hidden lg:block"
        >
          <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => setMobileOpen(false)} className="text-blue-300 hover:text-white lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-2">
        {sections.map((section, si) => {
          const visibleLinks = section.links.filter(link => canSee(link.href));
          if (visibleLinks.length === 0) return null;
          return (
            <div key={si}>
              {section.title && !collapsed && (
                <p className="text-[10px] text-blue-300/60 px-4 pt-3.5 pb-1 uppercase tracking-widest font-semibold">
                  {section.title}
                </p>
              )}
              {section.title && collapsed && si > 0 && (
                <div className="mx-3 my-2 border-t border-blue-800/40" />
              )}
              <div className="px-2 space-y-0.5">
                {visibleLinks.map((link) => (
                  <NavLink key={link.href} link={link} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

    </div>
  );

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-slate-900 border-t border-blue-800/40 flex">
        {bottomTabs.map(tab => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                active ? 'text-blue-400' : 'text-blue-300/60 hover:text-blue-200'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex-1 flex flex-col items-center py-2 gap-0.5 text-xs text-blue-300/60 hover:text-blue-200 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span>Menü</span>
        </button>
      </nav>

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

      {/* Mobile sidebar drawer */}
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
