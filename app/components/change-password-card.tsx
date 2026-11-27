'use client';

// Ayarlar: kendi şifresini değiştir. Başarılı olunca diğer oturumlar kapanır; bu tarayıcıda
// yeni şifreyle oturum yenilenir.

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { KeyRound, Loader2 } from '@/app/components/icons';

export function ChangePasswordCard({ provider = 'credentials' }: { provider?: 'credentials' | 'portal-credentials' }) {
  const { data } = useSession() || {};
  const email = (data?.user as any)?.email as string | undefined;
  // Portal: aynı e-posta birden fazla firmada olabilir; oturum bu hesapla yenilenir
  const accountId = provider === 'portal-credentials' ? ((data?.user as any)?.id as string | undefined) : undefined;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== again) return setMsg({ ok: false, text: 'Yeni şifreler aynı değil.' });
    setBusy(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: d?.error || 'Şifre değiştirilemedi' });
      if (email) await signIn(provider, { email, password: next, ...(accountId ? { accountId } : {}), redirect: false });
      setCurrent(''); setNext(''); setAgain('');
      setMsg({ ok: true, text: 'Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.' });
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none';
  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow-card p-6 space-y-3 border border-ink-200/80" data-testid="change-password">
      <div className="flex items-center gap-3 pb-3 border-b">
        <KeyRound className="w-5 h-5 text-brand-700" />
        <h2 className="font-semibold text-ink-700">Şifre değiştir</h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm text-ink-600 space-y-1"><span>Mevcut şifre</span>
          <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={input} required data-testid="pw-current" /></label>
        <label className="text-sm text-ink-600 space-y-1"><span>Yeni şifre</span>
          <input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={input} required data-testid="pw-new" /></label>
        <label className="text-sm text-ink-600 space-y-1"><span>Yeni şifre (tekrar)</span>
          <input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} className={input} required data-testid="pw-again" /></label>
      </div>
      <p className="text-xs text-ink-400">En az 8 karakter, 1 harf ve 1 rakam.</p>
      {msg ? <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`} data-testid="pw-msg">{msg.text}</p> : null}
      <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Şifreyi değiştir
      </button>
    </form>
  );
}
