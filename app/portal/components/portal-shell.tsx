'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, List, BookOpen, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/portal/dashboard', label: 'Ana Sayfa', icon: ShoppingBag },
  { href: '/portal/orders', label: 'Siparişlerim', icon: List },
  { href: '/portal/catalog', label: 'Katalog', icon: BookOpen },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const user = session?.user as any;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/portal/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">SC</div>
              <span className="font-semibold text-slate-800 hidden sm:block">Müşteri Portalı</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href || pathname?.startsWith(href + '/')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden sm:block">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/portal/login' })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Çıkış</span>
            </button>
            <button className="md:hidden p-1.5" onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-2 flex flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  pathname === href ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
