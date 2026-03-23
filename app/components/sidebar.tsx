'use client';

import { useSession, signOut } from 'next-auth/react';
import { useLanguage } from '@/lib/i18n/language-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Calculator, History, Settings, Shield, LogOut, Menu, X, ChevronLeft, FileText, Users, Truck
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
  const { data: session } = useSession() || {};
  const { t } = useLanguage();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN';

  const links = [
    { href: '/dashboard', label: t('common', 'dashboard'), icon: LayoutDashboard },
    { href: '/materials', label: t('common', 'materials'), icon: Package },
    { href: '/calculations/new', label: t('common', 'newCalculation'), icon: Calculator },
    { href: '/calculations', label: t('calculation', 'history'), icon: History },
    { href: '/quotes/new', label: 'Teklif Oluştur', icon: FileText },
    { href: '/customers', label: 'Müşteriler', icon: Users },
    { href: '/suppliers', label: 'Tedarikçiler', icon: Truck },
    { href: '/settings', label: t('common', 'settings'), icon: Settings },
  ];

  if (isAdmin) {
    links.push({ href: '/admin', label: t('common', 'admin'), icon: Shield });
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
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
        <button
          onClick={() => setMobileOpen(false)}
          className="text-blue-300 hover:text-white lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map((link: any) => {
          const Icon = link?.icon;
          const active = pathname === link?.href || (link?.href !== '/calculations' && pathname?.startsWith?.(link?.href ?? '___'));
          return (
            <Link
              key={link?.href}
              href={link?.href ?? '/dashboard'}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-blue-200 hover:bg-blue-800/50 hover:text-white'
              }`}
            >
              {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
              {!collapsed && <span>{link?.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-blue-800/30">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{user?.name ?? 'User'}</p>
            <p className="text-blue-300 text-xs truncate">{user?.companyName ?? ''}</p>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-red-600/20 hover:text-red-300 transition-all w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>{t('common', 'logout')}</span>}
        </button>
      </div>
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
