import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { getItem, setItem } from './storage';

// İsteğe bağlı Face ID / parmak izi kilidi: açıkken uygulama ön plana her geldiğinde
// (30 sn'den uzun arka planda kaldıysa) kimlik doğrulaması ister. Biyometrik veri cihazda kalır.

const KEY = 'solecost.biometric';
const GRACE_MS = 30_000;

type Ctx = { available: boolean; enabled: boolean; setEnabled: (v: boolean) => Promise<boolean> };
const BiometricCtx = createContext<Ctx>({ available: false, enabled: false, setEnabled: async () => false });

export function useBiometric() { return useContext(BiometricCtx); }

async function authenticate(prompt: string) {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Vazgeç' });
  return r.success;
}

export function BiometricGate({ active, children }: { active: boolean; children: ReactNode }) {
  const c = useTheme();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setAvailable(ok);
      const on = ok && (await getItem(KEY)) === '1';
      setEnabledState(on);
      if (on && active) setLocked(true);
    })();
  }, [active]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') backgroundAt.current = Date.now();
      if (s === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > GRACE_MS && enabled && active) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled, active]);

  const unlock = useCallback(async () => {
    if (await authenticate('SoleCost kilidini açın')) setLocked(false);
  }, []);

  useEffect(() => { if (locked) void unlock(); }, [locked, unlock]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v && !(await authenticate('Kilidi etkinleştirmek için doğrulayın'))) return false;
    await setItem(KEY, v ? '1' : '0');
    setEnabledState(v);
    return true;
  }, []);

  return (
    <BiometricCtx.Provider value={{ available, enabled, setEnabled }}>
      {children}
      {locked && active && (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: c.background }]}>
          <Text style={[styles.title, { color: c.text }]}>SoleCost kilitli</Text>
          <Pressable onPress={unlock} style={[styles.button, { backgroundColor: c.primary }]} accessibilityRole="button">
            <Text style={{ color: c.primaryText, fontWeight: '600' }}>Kilidi aç</Text>
          </Pressable>
        </View>
      )}
    </BiometricCtx.Provider>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
  title: { fontSize: 20, fontWeight: '700' },
  button: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
});
