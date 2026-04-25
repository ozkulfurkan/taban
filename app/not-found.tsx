'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/dashboard'), 2000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-slate-200 mb-2">404</p>
        <p className="text-slate-500 text-sm">Sayfa bulunamadı, yönlendiriliyorsunuz...</p>
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
    </div>
  );
}
