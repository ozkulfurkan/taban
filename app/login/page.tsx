'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Eye, EyeOff, Loader2, ExternalLink, CheckCircle2, MailWarning, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';

function UnverifiedEmailBanner({ email }: { email: string }) {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleResend = async () => {
    if (resendLoading || resendSent) return;
    setResendLoading(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 overflow-hidden"
    >
      <div className="flex gap-3 p-4">
        <MailWarning className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-200 text-sm font-medium">E-posta adresiniz henüz doğrulanmamış.</p>
          <p className="text-amber-300/70 text-xs mt-0.5">Lütfen gelen kutunuzu kontrol edin.</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <button
          onClick={handleResend}
          disabled={resendLoading || resendSent}
          className="w-full py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : resendSent ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          <span className={resendSent ? 'text-green-400' : ''}>
            {resendSent ? 'Doğrulama Maili Gönderildi!' : 'Doğrulama Mailini Tekrar Gönder'}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccess('Kayıt başarılı. Lütfen e-posta adresinizi doğrulayın.');
    }
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
    setUnverifiedEmail('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        if (result.error === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(email);
        } else {
          setError('E-posta veya şifre hatalı.');
        }
      } else {
        router.replace('/dashboard');
      }
    } catch {
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

          <AnimatePresence mode="wait">
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-start gap-3 p-4 bg-green-500/15 border border-green-500/25 rounded-xl"
              >
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-green-200 text-sm leading-relaxed">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {unverifiedEmail ? (
              <UnverifiedEmailBanner key="unverified" email={unverifiedEmail} />
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>

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

          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
            <Link
              href="/portal/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/20 text-blue-200 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Ayakkabıcı Portalı
            </Link>
            <Link
              href="/portal/fason/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 hover:text-orange-200 transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Fasoncu Portalı
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
