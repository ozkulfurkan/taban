'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setSuccess('E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.');
    }
    if (searchParams.get('error') === 'invalid-token') {
      setError('Geçersiz veya süresi dolmuş doğrulama bağlantısı.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        const statusRes = await fetch('/api/auth/check-login-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const status = await statusRes.json();
        if (status.exists && !status.emailVerified) {
          setError('E-posta adresiniz henüz doğrulanmamış. Doğrulama maili gönderildi, lütfen gelen kutunuzu kontrol edin.');
        } else {
          setError('E-posta veya şifre hatalı.');
        }
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <span className="text-white font-bold text-2xl">SC</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SoleCost</h1>
          <p className="text-blue-300 text-sm">{t('auth', 'loginDesc')}</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-6">{t('auth', 'loginTitle')}</h2>
          
          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">{t('auth', 'email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="email@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">{t('auth', 'password')}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {t('auth', 'login')}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2">
            <Link href="/forgot-password" className="text-sm text-blue-300 hover:text-white transition-colors">
              Şifremi Unuttum
            </Link>
            <p className="text-center text-sm text-blue-300">
              {t('auth', 'noAccount')}{' '}
              <Link href="/register" className="text-blue-400 hover:text-white font-medium transition-colors">
                {t('auth', 'register')}
              </Link>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <Link
              href="/portal/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/20 text-blue-200 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Ayakkabıcı Portalı
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
