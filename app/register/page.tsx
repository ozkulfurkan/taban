'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Eye, EyeOff, Loader2, Mail, CheckCircle2, ArrowRight, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';

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
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="relative z-10 bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-black/60"
      >
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
              className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.25 }}
                className="w-12 h-12 rounded-full bg-green-500/25 flex items-center justify-center"
              >
                <CheckCircle2 className="w-7 h-7 text-green-400" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border border-green-500/30"
            />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-7">
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white mb-4"
          >
            Hesabınız Oluşturuldu 🎉
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-1.5 text-slate-300 text-sm leading-relaxed"
          >
            <p>E-posta adresinize doğrulama bağlantısı gönderdik.</p>
            <p>Hesabınızı aktifleştirmek için lütfen e-postanızı kontrol edin.</p>
            <p className="text-slate-500 text-xs mt-3">
              Doğrulama tamamlandıktan sonra giriş yapabilirsiniz.
            </p>
          </motion.div>

          {/* Email chip */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2"
          >
            <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-blue-300 text-sm font-medium truncate max-w-[240px]">{email}</span>
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
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - countdown / 3)}
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              {countdown}
            </span>
          </div>
          <span className="text-slate-400 text-xs">
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30"
          >
            <ArrowRight className="w-4 h-4" />
            Giriş Sayfasına Git
          </button>
          <button
            onClick={handleResend}
            disabled={resendLoading || resendSent}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : resendSent ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className={resendSent ? 'text-green-400' : ''}>
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
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        : <XCircle className="w-3.5 h-3.5 text-red-400/70 flex-shrink-0" />}
      <span className={`text-xs ${ok ? 'text-green-300' : 'text-slate-400'}`}>{text}</span>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <AnimatePresence>
        {showSuccessModal && (
          <SuccessModal email={registeredEmail} onGoToLogin={handleGoToLogin} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: showSuccessModal ? 0.3 : 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <span className="text-white font-bold text-2xl">SC</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SoleCost</h1>
          <p className="text-blue-300 text-sm">{t('auth', 'registerDesc')}</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-6">{t('auth', 'registerTitle')}</h2>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">{t('auth', 'fullName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">{t('auth', 'companyName')}</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">{t('auth', 'email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1.5">{t('auth', 'password')}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-12"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              {t('auth', 'register')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-blue-300">
            {t('auth', 'hasAccount')}{' '}
            <Link href="/login" className="text-blue-400 hover:text-white font-medium transition-colors">
              {t('auth', 'login')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
