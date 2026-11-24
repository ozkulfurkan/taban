'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Factory, List, Package, LogOut, Menu, X } from '@/app/components/icons';
import { useState } from 'react';

const NAV = [
  { href: '/portal/fason/dashboard', label: 'Ana Sayfa', icon: Factory },
  { href: '/portal/fason/orders', label: 'Siparişlerim', icon: List },
  { href: '/portal/fason/stock', label: 'Hammadde Stoğum', icon: Package },
];

export default function FasonPortalShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const user = session?.user as any;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/portal/fason/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-700 rounded-lg flex items-center justify-center text-white font-bold text-xs">F</div>
              <span className="font-semibold text-ink-800 hidden sm:block">Fasoncu Portalı</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === href || pathname.startsWith(href + '/') ? 'bg-brand-100 text-brand-800' : 'text-ink-600 hover:text-ink-900 hover:bg-ink-100'}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-600 hidden sm:block">{user?.name ?? user?.email}</span>
            <button onClick={() => signOut({ callbackUrl: '/portal/fason/login' })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Çıkış</span>
            </button>
            <button className="sm:hidden p-1.5 text-ink-600" onClick={() => setMobileOpen(p => !p)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="sm:hidden border-t border-ink-100 bg-white px-4 py-2 space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${pathname === href ? 'bg-brand-100 text-brand-800' : 'text-ink-600'}`}>
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
