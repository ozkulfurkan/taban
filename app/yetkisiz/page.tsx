'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';
import { PAGE_KEYS, canSeePage } from '@/lib/access';

const NAV_LABELS: Record<string, [string, string]> = {
  '/dashboard': ['nav', 'home'],
  '/customers': ['nav', 'customers'],
  '/suppliers': ['nav', 'suppliers'],
  '/invoices': ['nav', 'sales'],
  '/products': ['nav', 'products'],
  '/materials': ['nav', 'rawMaterials'],
  '/accounts': ['nav', 'accounts'],
  '/cek-portfolyo': ['nav', 'checkPortfolio'],
  '/settings': ['nav', 'settings'],
};

export default function YetkisizPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const user = session?.user as any;

  const pages = PAGE_KEYS
    .map(([href]) => href)
    .filter((href, i, all) => all.indexOf(href) === i && NAV_LABELS[href] && canSeePage(user, href));

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-5">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-800">{t('access', 'title')}</h1>
          <p className="text-sm text-slate-500">{t('access', 'body')}</p>
        </div>
        {user && (
          <div className="text-left space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('access', 'allowed')}</p>
            {pages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pages.map(href => (
                  <Link key={href} href={href}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm hover:bg-blue-100">
                    {t(NAV_LABELS[href][0], NAV_LABELS[href][1])}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('access', 'none')}</p>
            )}
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-slate-500 hover:text-slate-700 underline">
          {t('access', 'logout')}
        </button>
      </div>
    </div>
  );
}
