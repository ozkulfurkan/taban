import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getItem, setItem } from './storage';

// Görünüm tercihi: Açık (varsayılan) · Koyu · Sistem. Cihazda saklanır.
export type ThemePref = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

const KEY = 'solecost.theme';
const Ctx = createContext<{ pref: ThemePref; scheme: Scheme; setPref: (p: ThemePref) => void }>({
  pref: 'light', scheme: 'light', setPref: () => {},
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('light');

  useEffect(() => {
    getItem(KEY).then(v => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); }).catch(() => {});
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    void setItem(KEY, p).catch(() => {});
  }, []);

  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo(() => ({ pref, scheme, setPref }), [pref, scheme, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useThemePreference = () => useContext(Ctx);
