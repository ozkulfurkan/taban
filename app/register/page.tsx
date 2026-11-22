'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Eye, EyeOff, Loader2, Mail, CheckCircle2, ArrowRight, RotateCcw, XCircle } from '@/app/components/icons';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';
import { AuthShell } from '@/app/components/auth-shell';
import { BrandMark } from '@/app/components/brand-mark';

function SuccessModal({
  email,
  onGoToLogin,
}: {
  email: string;
  onGoToLogin: () => void;
}) {
  const [countdown, setCountdown] = useState(3);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onGoToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onGoToLogin]);

  const handleResend = async () => {
    if (resendSent || resendLoading) return;
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

  const circumference = 2 * Math.PI * 14;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="relative z-10 bg-white border border-ink-200 rounded-2xl p-8 max-w-md w-full shadow-pop"
      >
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
              className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.25 }}
                className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center"
              >
                <CheckCircle2 className="w-7 h-7 text-emerald-600" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border border-emerald-300"
            />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-7">
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-ink-900 mb-4"
          >
            Hesabınız Oluşturuldu 🎉
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-1.5 text-ink-600 text-sm leading-relaxed"
          >
            <p>E-posta adresinize doğrulama bağlantısı gönderdik.</p>
            <p>Hesabınızı aktifleştirmek için lütfen e-postanızı kontrol edin.</p>
            <p className="text-ink-500 text-xs mt-3">
              Doğrulama tamamlandıktan sonra giriş yapabilirsiniz.
            </p>
          </motion.div>

          {/* Email chip */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 inline-flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-full px-4 py-2"
          >
            <Mail className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />
            <span className="text-ink-500 text-sm font-medium truncate max-w-[240px]">{email}</span>
          </motion.div>
        </div>

        {/* Countdown ring */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="flex items-center justify-center gap-3 mb-6"
        >
          <div className="relative w-9 h-9 flex-shrink-0">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="#8A2438"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - countdown / 3)}
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-ink-900 text-xs font-bold">
              {countdown}
            </span>
          </div>
          <span className="text-ink-400 text-xs">
            saniye içinde giriş sayfasına yönlendiriliyorsunuz
          </span>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2.5"
        >
          <button
            onClick={onGoToLogin}
            className="w-full py-3 bg-brand-700 hover:bg-brand-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-700/25 hover:shadow-brand-600/30"
          >
            <ArrowRight className="w-4 h-4" />
            Giriş Sayfasına Git
          </button>
          <button
            onClick={handleResend}
            disabled={resendLoading || resendSent}
            className="w-full py-3 bg-ink-50 hover:bg-ink-100 border border-ink-200 hover:border-ink-200 text-ink-300 hover:text-ink-900 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : resendSent ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className={resendSent ? 'text-emerald-600' : ''}>
              {resendSent ? 'Mail Gönderildi!' : 'Tekrar Mail Gönder'}
            </span>
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function passwordRules(pass: string) {
  return {
    minLength: pass.length >= 6,
    hasLetter: /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(pass),
    hasNumber: /[0-9]/.test(pass),
  };
}

function PasswordRule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        : <XCircle className="w-3.5 h-3.5 text-red-500/70 flex-shrink-0" />}
      <span className={`text-xs ${ok ? 'text-emerald-700' : 'text-ink-400'}`}>{text}</span>
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', name: '', companyName: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const rules = passwordRules(form.password);
  const passwordValid = rules.minLength && rules.hasLetter && rules.hasNumber;

  const handleGoToLogin = () => {
    router.replace('/login?registered=1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Kayıt başarısız');
        return;
      }
      setRegisteredEmail(form.email);
      setShowSuccessModal(true);
    } catch {
      setError('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AuthShell
      title={t('auth', 'registerTitle')}
      subtitle={t('auth', 'registerDesc')}
      panelTitle={<>İlk faturanızı<br /><em className="italic font-normal text-[#EBC8CE]">bugün kesin.</em></>}
    >
      <AnimatePresence>
        {showSuccessModal && (
          <SuccessModal email={registeredEmail} onGoToLogin={handleGoToLogin} />
        )}
      </AnimatePresence>
        <div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-ink-700 mb-1.5">{t('auth', 'fullName')}</label>
              <input
                id="reg-name"
                autoComplete="name"
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="input py-2.5 text-[15px]"
                required
              />
            </div>
            <div>
              <label htmlFor="reg-company" className="block text-sm font-medium text-ink-700 mb-1.5">{t('auth', 'companyName')}</label>
              <input
                id="reg-company"
                autoComplete="organization"
                type="text"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className="input py-2.5 text-[15px]"
                required
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-ink-700 mb-1.5">{t('auth', 'email')}</label>
              <input
                id="reg-email"
                autoComplete="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="input py-2.5 text-[15px]"
                required
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-ink-700 mb-1.5">{t('auth', 'password')}</label>
              <div className="relative">
                <input
                  id="reg-password"
                  autoComplete="new-password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="input py-2.5 text-[15px] pr-12"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  aria-label={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex gap-4 flex-wrap">
                  <PasswordRule ok={rules.minLength} text="En az 6 karakter" />
                  <PasswordRule ok={rules.hasLetter} text="En az 1 harf" />
                  <PasswordRule ok={rules.hasNumber} text="En az 1 rakam" />
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !passwordValid}
              className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              {t('auth', 'register')}
            </button>
          </form>

          <p className="mt-8 text-sm text-ink-600">
            {t('auth', 'hasAccount')}{' '}
            <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-4">
              {t('auth', 'login')}
            </Link>
          </p>
        </div>
    </AuthShell>
  );
}
