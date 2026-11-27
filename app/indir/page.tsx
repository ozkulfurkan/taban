import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BrandMark } from '@/app/components/brand-mark';
import { APP_STORE_URL } from '@/lib/app-links';

// Davet bağlantısı (www.solecost.com/indir): iPhone'dan açılırsa App Store'a yönlendirir,
// diğer cihazlarda uygulama ve web girişi bağlantılarını gösterir.
// App Store adresi: lib/app-links.ts (NEXT_PUBLIC_APP_STORE_URL ile değiştirilebilir).

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'SoleCost uygulamasını indirin',
  description: 'Siparişlerinizi, ekstrenizi ve kataloğu SoleCost mobil uygulamasından ya da web portalından takip edin.',
};

export default function Indir() {
  const appStore = APP_STORE_URL;
  const ua = headers().get('user-agent') || '';
  if (appStore && /iPhone|iPad|iPod/i.test(ua)) redirect(appStore);

  return (
    <main className="min-h-screen bg-[#6B1A2C] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 border border-ink-200/80">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={72} />
          <h1 className="page-title">SoleCost</h1>
          <p className="text-ink-500 text-sm">Siparişlerinizi verin, durumunu takip edin, ekstrenizi ve kataloğu görün.</p>
        </div>
        <div className="space-y-3">
          {appStore ? (
            <a href={appStore} className="block w-full py-3 rounded-xl bg-black text-white font-semibold" data-testid="indir-appstore">
              App Store&apos;dan indir (iPhone)
            </a>
          ) : (
            <div className="w-full py-3 rounded-xl bg-ink-100 text-ink-500 font-medium" data-testid="indir-soon">iPhone uygulaması yakında App Store&apos;da</div>
          )}
          <p className="text-xs text-ink-400" data-testid="indir-android">Android uygulaması yakında. Android telefonda web girişini kullanabilirsiniz.</p>
          <Link href="/portal/login" className="block w-full py-3 rounded-xl bg-[#6B1A2C] text-white font-semibold" data-testid="indir-portal">
            Müşteri olarak web&apos;den giriş
          </Link>
          <Link href="/login" className="block w-full py-3 rounded-xl border border-ink-200 text-ink-700 font-medium">
            Firma girişi
          </Link>
        </div>
        <p className="text-xs text-ink-400">Giriş bilgilerinizi size davet gönderen firmadan alabilirsiniz.</p>
      </div>
    </main>
  );
}
