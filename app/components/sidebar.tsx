'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, Settings, Shield, LogOut, Menu, X, ChevronLeft,
  FileText, Users, Truck, BoxIcon, Receipt, CreditCard, Package, Landmark
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LinkItem = { href: string; label: string; icon: any; special?: boolean };
type Section = { title?: string; links: LinkItem[] };

export default function Sidebar() {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN';

  const sections: Section[] = [
    {
      links: [
        { href: '/dashboard', label: 'Ana Sayfa', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Ticari',
      links: [
        { href: '/customers', label: 'Müşteriler', icon: Users },
        { href: '/suppliers', label: 'Tedarikçiler', icon: Truck },
        { href: '/invoices', label: 'Satışlar', icon: Receipt },
        { href: '/quotes/new', label: 'Teklifler', icon: FileText },
        { href: '/payments', label: 'Ödemeler', icon: CreditCard },
      ],
    },
    {
      title: 'Stok',
      links: [
        { href: '/products', label: 'Ürünler', icon: BoxIcon },
        { href: '/materials', label: 'Hammaddeler', icon: Package },
      ],
    },
    {
      title: 'Nakit Yönetimi',
      links: [
        { href: '/accounts', label: 'Hesaplarım', icon: Landmark },
      ],
    },
    {
      title: 'Araçlar',
      links: [
        { href: '/calculations/new', label: 'Taban Maliyet Hesapla', icon: Calculator, special: true },
      ],
    },
    {
      title: 'Sistem',
      links: [
        { href: '/settings', label: 'Ayarlar', icon: Settings },
        ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/calculations/new') return pathname === href;
    if (href === '/quotes/new') return pathname === href || pathname?.startsWith('/quotes');
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
              {section.links.map((link) => {
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

      {/* User + Logout */}
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
          {!collapsed && <span>Çıkış Yap</span>}
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
