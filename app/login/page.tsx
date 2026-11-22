'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Eye, EyeOff, Loader2, ExternalLink, CheckCircle2, MailWarning, RotateCcw } from '@/app/components/icons';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';
import { AuthShell, AuthField, authInput, authPrimary } from '@/app/components/auth-shell';

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
      className="mb-5 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden"
    >
      <div className="flex gap-3 p-4">
        <MailWarning className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-900 text-sm font-medium">E-posta adresiniz henüz doğrulanmamış.</p>
          <p className="text-amber-800/80 text-xs mt-0.5">Lütfen gelen kutunuzu kontrol edin.</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <button
          onClick={handleResend}
          disabled={resendLoading || resendSent}
          className="w-full py-2 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : resendSent ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          <span className={resendSent ? 'text-emerald-700' : ''}>
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
        if (result.error === 'TOO_MANY_ATTEMPTS') {
          setError('Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin veya şifrenizi sıfırlayın.');
        } else if (result.error === 'COMPANY_DELETION_PENDING') {
          setError('Firma hesabı silinme sürecinde olduğu için giriş yapılamıyor. Firma sahibiyle iletişime geçin.');
        } else if (result.error === 'EMAIL_NOT_VERIFIED') {
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
    <AuthShell
      title={t('auth', 'loginTitle')}
      subtitle={t('auth', 'loginDesc')}
      footer={
        <div className="space-y-6">
          <p className="text-sm text-ink-600">
            {t('auth', 'noAccount')}{' '}
            <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline">
              {t('auth', 'register')}
            </Link>
          </p>
          <div className="pt-6 border-t border-ink-200">
            <p className="section-title mb-3">Portallar</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/portal/login" className="btn-secondary text-[13px]">
                <ExternalLink className="w-4 h-4" /> Müşteri portalı
              </Link>
              <Link href="/portal/fason/login" className="btn-secondary text-[13px]">
                <ExternalLink className="w-4 h-4" /> Fasoncu portalı
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-5 flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-800 text-sm leading-relaxed">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {unverifiedEmail ? (
          <UnverifiedEmailBanner key="unverified" email={unverifiedEmail} />
        ) : error ? (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label={t('auth', 'email')}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInput}
            placeholder="ornek@firma.com"
            required
          />
        </AuthField>
        <AuthField
          label={t('auth', 'password')}
          hint={<Link href="/forgot-password" className="text-[13px] font-medium text-brand-700 hover:text-brand-800">Şifremi unuttum</Link>}
        >
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInput} pr-11`}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
            >
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </AuthField>
        <button type="submit" disabled={loading} className={authPrimary}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          {t('auth', 'login')}
        </button>
      </form>
    </AuthShell>
  );
}
