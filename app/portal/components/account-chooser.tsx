'use client';

// Portal girişinde firma seçimi: aynı e-posta ve şifre birden fazla firmanın portal hesabına uyuyorsa
// kullanıcı hangi firmanın portalına gireceğini seçer.
import { Building2, ChevronRight } from '@/app/components/icons';

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
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="text-sm text-ink-700/80">{hint}</p>
      <div className="space-y-2">
        {accounts.map(a => (
          <button key={a.id} type="button" onClick={() => onChoose(a)} disabled={!!busy} data-testid={`choose-${a.id}`}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-white/20 border border-white/15 text-left text-ink-900 disabled:opacity-60">
            <Building2 className="w-5 h-5 shrink-0 text-ink-700" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{a.companyName}</span>
              {a.portalType === 'SUBCONTRACTOR' ? <span className="block text-xs text-ink-700/80">{fasonLabel}</span> : null}
            </span>
            <ChevronRight className="w-4 h-4 text-ink-700" />
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-ink-700 hover:text-ink-900">{back}</button>
    </div>
  );
}
