'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PortalVerifyEmailPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); return; }

    fetch(`/api/portal/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => setStatus(d.ok ? 'success' : 'error'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        {status === 'loading' && <p className="text-slate-600">Doğrulanıyor...</p>}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">E-posta Doğrulandı</h2>
            <p className="text-slate-500 mb-6">Hesabınız aktif edildi. Giriş yapabilirsiniz.</p>
            <Link href="/portal/login" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Giriş Yap
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Geçersiz Bağlantı</h2>
            <p className="text-slate-500">Doğrulama bağlantısı geçersiz veya süresi dolmuş.</p>
          </>
        )}
      </div>
    </div>
  );
}
