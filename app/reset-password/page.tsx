'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from '@/app/components/icons';
import Link from 'next/link';
import { passwordError } from '@/lib/password';
import { AuthShell } from '@/app/components/auth-shell';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    const pwErr = passwordError(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu');
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-700 mb-4">Geçersiz sıfırlama bağlantısı.</p>
        <Link href="/forgot-password" className="text-ink-500 hover:text-ink-900 text-sm">
          Yeni bağlantı oluştur →
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/login" className="flex items-center gap-2 text-ink-500 hover:text-ink-900 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Giriş sayfasına dön
      </Link>

      
      <p className="text-ink-500 text-sm mb-6">Yeni şifrenizi girin.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <p className="text-ink-900 font-medium">Şifreniz başarıyla güncellendi!</p>
          <p className="text-ink-500 text-sm mt-1">Giriş sayfasına yönlendiriliyorsunuz...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Yeni Şifre</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input py-2.5 text-[15px] transition pr-12"
                placeholder="En az 8 karakter, harf ve rakam"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Şifre Tekrar</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="input py-2.5 text-[15px] transition"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Şifreyi Güncelle
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Yeni şifre belirleyin" subtitle="En az 8 karakter; harf ve rakam içersin.">
      <Suspense fallback={<div className="text-ink-500">Yükleniyor…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
