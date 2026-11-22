'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Loader2, Copy, CheckCircle } from '@/app/components/icons';
import Link from 'next/link';
import { AuthShell } from '@/app/components/auth-shell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setPreviewUrl('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu');
      } else {
        setSuccessMessage(data.message || 'Şifre sıfırlama bağlantısı gönderildi.');
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!previewUrl) return;
    navigator.clipboard.writeText(previewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AuthShell
      title="Şifremi unuttum"
      subtitle="Kayıtlı e-posta adresinizi girin; şifre sıfırlama bağlantısı gönderelim."
      footer={
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-ink-900">
          <ArrowLeft className="w-4 h-4" /> Giriş sayfasına dön
        </Link>
      }
    >
        <div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {!successMessage ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 input py-2.5 text-[15px] transition"
                    placeholder="ornek@firma.com"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                Sıfırlama Bağlantısı Oluştur
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{successMessage}</span>
              </div>
              <p className="text-ink-500 text-sm">
                E-posta gönderildi. Lütfen gelen kutunuzu ve spam klasörünü kontrol edin.
              </p>
              {previewUrl ? (
                <>
                  <div className="bg-ink-50 border border-ink-200 rounded-lg p-3 break-all text-xs text-ink-700 font-mono">
                    {previewUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="w-full py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Kopyalandı!' : 'Önizleme Bağlantısını Kopyala'}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
    </AuthShell>
  );
}
