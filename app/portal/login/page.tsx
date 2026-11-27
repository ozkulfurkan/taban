'use client';

import { AppStoreBadge } from '@/app/components/app-store-badge';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccountChooser, fetchPortalAccounts, portalHome, type PortalAccountChoice } from '@/app/portal/components/account-chooser';
import { Loader2, Eye, EyeOff } from '@/app/components/icons';
import { usePortalText } from '@/lib/i18n/portal';
import { AuthShell } from '@/app/components/auth-shell';

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
    <AuthShell
      title={tp('Müşteri Portalı')}
      subtitle={tp('SoleCost B2B Sipariş Sistemi')}
      panelTitle={<>{tp('Siparişiniz,')}<br /><em className="italic font-normal text-[#EBC8CE]">{tp('adım adım gözünüzün önünde.')}</em></>}
      panelPoints={[tp('Katalogdan sipariş verin'), tp('Onay, üretim ve sevkiyatı takip edin'), tp('Hesap ekstrenizi görüntüleyin')]}
    >
        <div>

          {verified && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
              {tp('E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.')}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
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
                <label className="block text-sm font-medium text-ink-700 mb-1.5">{tp('E-posta')}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="input py-2.5 text-[15px]"
                  placeholder="ornek@firma.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">{tp('Şifre')}</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    className="input py-2.5 text-[15px] pr-10" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {tp('Giriş Yap')}
              </button>
            </form>
          )}
          <div className="mt-6 flex justify-center"><AppStoreBadge size="sm" testId="portal-login-app-store" /></div>
        </div>
    </AuthShell>
  );
}
