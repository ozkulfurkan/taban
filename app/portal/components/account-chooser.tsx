'use client';

// Portal girişinde firma seçimi: aynı e-posta ve şifre birden fazla firmanın portal hesabına uyuyorsa
// kullanıcı hangi firmanın portalına gireceğini seçer.
import { Building2, ChevronRight } from 'lucide-react';

export type PortalAccountChoice = { id: string; companyName: string; portalType: string };

/** Uyan hesapları getirir (giriş hatası CHOOSE_ACCOUNT olduğunda) */
export async function fetchPortalAccounts(email: string, password: string): Promise<PortalAccountChoice[]> {
  const res = await fetch('/api/portal/auth/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const d = await res.json().catch(() => ({}));
  return Array.isArray(d?.accounts) ? d.accounts : [];
}

export const portalHome = (portalType: string) => (portalType === 'SUBCONTRACTOR' ? '/portal/fason/dashboard' : '/portal/dashboard');

export function AccountChooser({ accounts, onChoose, onCancel, busy, title, hint, fasonLabel, back }: {
  accounts: PortalAccountChoice[]; onChoose: (a: PortalAccountChoice) => void; onCancel: () => void; busy?: string | null;
  title: string; hint: string; fasonLabel: string; back: string;
}) {
  return (
    <div className="space-y-3" data-testid="account-chooser">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-blue-200/80">{hint}</p>
      <div className="space-y-2">
        {accounts.map(a => (
          <button key={a.id} type="button" onClick={() => onChoose(a)} disabled={!!busy} data-testid={`choose-${a.id}`}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-left text-white disabled:opacity-60">
            <Building2 className="w-5 h-5 shrink-0 text-blue-200" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{a.companyName}</span>
              {a.portalType === 'SUBCONTRACTOR' ? <span className="block text-xs text-blue-200/80">{fasonLabel}</span> : null}
            </span>
            <ChevronRight className="w-4 h-4 text-blue-200" />
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-blue-200 hover:text-white">{back}</button>
    </div>
  );
}
