import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { TOKEN_KEY, getItem, removeItem, setItem } from './storage';

export type StaffUser = {
  id: string; name: string | null; email: string; type: 'staff';
  role: 'ADMIN' | 'COMPANY_OWNER' | 'EDITOR' | 'VIEWER'; companyName: string | null;
  companyType?: string; allowedPages: string[]; language: string; currency: string;
};
export type PortalUser = { id: string; name: string | null; email: string; type: 'portal'; portalType: 'CUSTOMER' | 'SUBCONTRACTOR' };
export type User = StaffUser | PortalUser;

type AuthState = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string, kind: 'staff' | 'portal') => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await removeItem(TOKEN_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const r = await api<{ user: User }>('/api/mobile/auth/me');
    setUser(r.user);
  }, []);

  // Açılışta kayıtlı oturumu yükle ve sunucuda hâlâ geçerli olduğunu doğrula
  useEffect(() => {
    setUnauthorizedHandler(() => { void signOut(); });
    (async () => {
      try {
        const saved = await getItem(TOKEN_KEY);
        if (saved) {
          setAuthToken(saved);
          try {
            await refresh();
          } catch (e: any) {
            // Bağlantı yoksa oturumu silme; sadece 401'de çıkış yapılır (api.ts)
            if (e?.status === 401) await signOut();
          }
        }
      } finally {
        setReady(true);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [refresh, signOut]);

  const signIn = useCallback(async (email: string, password: string, kind: 'staff' | 'portal') => {
    const r = await api<{ token: string; user: User }>('/api/mobile/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password, kind },
    });
    await setItem(TOKEN_KEY, r.token);
    setAuthToken(r.token);
    setUser(r.user);
  }, []);

  const value = useMemo(() => ({ ready, user, signIn, signOut, refresh }), [ready, user, signIn, signOut, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth AuthProvider içinde kullanılmalı');
  return v;
}

/** Firma kullanıcısı kayıt ekleyip değiştirebilir mi (görüntüleyici yalnızca okur) */
export function useCanWrite() {
  const { user } = useAuth();
  return user?.type === 'staff' && user.role !== 'VIEWER';
}

/** Web'deki sayfa izinleriyle aynı: sahip/yönetici her şeyi, diğerleri izin verilen sayfaları görür */
export function useCanSee(page: string) {
  const { user } = useAuth();
  if (user?.type !== 'staff') return false;
  if (user.role === 'ADMIN' || user.role === 'COMPANY_OWNER') return true;
  return (user.allowedPages ?? []).includes(page);
}

/** Silme yalnızca firma sahibi/yöneticide (web ile aynı: düzenleyici silemez) */
export function useCanDelete() {
  const { user } = useAuth();
  return user?.type === 'staff' && (user.role === 'ADMIN' || user.role === 'COMPANY_OWNER');
}
