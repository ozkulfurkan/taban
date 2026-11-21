'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccountChooser, fetchPortalAccounts, portalHome, type PortalAccountChoice } from '@/app/portal/components/account-chooser';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { usePortalText } from '@/lib/i18n/portal';
import { BrandMark } from '@/app/components/brand-mark';

export default function PortalLoginPage() {
  const { tp } = usePortalText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verified = searchParams.get('verified') === '1';

  const [accounts, setAccounts] = useState<PortalAccountChoice[] | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  // Aynı e-posta birden fazla firmada portal hesabıysa önce firma seçilir (CHOOSE_ACCOUNT)
  const doSignIn = async (account?: PortalAccountChoice) => {
    const result = await signIn('portal-credentials', {
      email,
      password,
      ...(account ? { accountId: account.id } : {}),
      redirect: false,
    });
    if (result?.error === 'CHOOSE_ACCOUNT') {
      const list = await fetchPortalAccounts(email, password);
      if (list.length) { setAccounts(list); return; }
      setError(tp('E-posta adresi veya şifre hatalı.'));
    } else if (result?.error === 'EMAIL_NOT_VERIFIED') {
      setError(tp('E-posta adresiniz doğrulanmamış. Doğrulama maili gönderildi, lütfen gelen kutunuzu kontrol edin.'));
    } else if (result?.error === 'TOO_MANY_ATTEMPTS') {
      setError(tp('Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin veya şifrenizi sıfırlayın.'));
    } else if (result?.error === 'ACCOUNT_INACTIVE') {
      setError(tp('Hesabınız pasif durumda. Lütfen firma sahibi ile iletişime geçin.'));
    } else if (result?.error) {
      setError(tp('E-posta adresi veya şifre hatalı.'));
    } else {
      router.replace(account ? portalHome(account.portalType) : '/portal/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await doSignIn();
    } finally {
      setLoading(false);
    }
  };

  const choose = async (a: PortalAccountChoice) => {
    setError('');
    setChoosing(a.id);
    try {
      await doSignIn(a);
    } finally {
      setChoosing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandMark size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-white">{tp('Müşteri Portalı')}</h1>
          <p className="text-blue-300 text-sm mt-1">{tp('SoleCost B2B Sipariş Sistemi')}</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-5">{tp('Giriş Yap')}</h2>

          {verified && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm">
              {tp('E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.')}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {accounts ? (
            <AccountChooser
              accounts={accounts}
              onChoose={a => { void choose(a); }}
              onCancel={() => { setAccounts(null); setError(''); }}
              busy={choosing}
              title={tp('Firma seçin')}
              hint={tp('Bu e-posta birden fazla firmanın portalında kayıtlı. Giriş yapmak istediğiniz firmayı seçin.')}
              fasonLabel={tp('Fasoncu portalı')}
              back={tp('Geri')}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1.5">{tp('E-posta')}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1.5">{tp('Şifre')}</label>
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
                {tp('Giriş Yap')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
