'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function PortalLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verified = searchParams.get('verified') === '1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn('portal-credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/portal/dashboard',
      });
      if (result?.error === 'EMAIL_NOT_VERIFIED') {
        setError('E-posta adresiniz doğrulanmamış. Doğrulama maili gönderildi, lütfen gelen kutunuzu kontrol edin.');
      } else if (result?.error === 'ACCOUNT_INACTIVE') {
        setError('Hesabınız pasif durumda. Lütfen firma sahibi ile iletişime geçin.');
      } else if (result?.error) {
        setError('E-posta adresi veya şifre hatalı.');
      } else {
        router.replace('/portal/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <span className="text-white font-bold text-xl">SC</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Müşteri Portalı</h1>
          <p className="text-blue-300 text-sm mt-1">SoleCost B2B Sipariş Sistemi</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-5">Giriş Yap</h2>

          {verified && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm">
              E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">Şifre</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
