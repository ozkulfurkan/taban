'use client';

import { useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ImpersonatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { router.replace('/admin'); return; }

    signIn('credentials', { impersonateToken: token, redirect: false }).then((result) => {
      if (result?.error) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <p className="text-slate-300">Hesaba geçiş yapılıyor...</p>
      </div>
    </div>
  );
}
