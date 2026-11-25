import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/core/auth';
import { BiometricGate } from '@/core/biometric';
import { NotificationBridge } from '@/core/notification-bridge';
import { ThemePreferenceProvider } from '@/core/theme-pref';
import { DialogHost } from '@/components/dialog-host';
import { Welcome } from '@/components/welcome';
import { useScheme, useTheme } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready, user } = useAuth();
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  if (!ready) return null;
  const staff = user?.type === 'staff';
  const portal = user?.type === 'portal';
  return (
    <BiometricGate active={!!user}>
      <NotificationBridge />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
          <Stack.Screen name="sifremi-unuttum" />
        </Stack.Protected>
        <Stack.Protected guard={staff}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={portal}>
          <Stack.Screen name="(portal)" />
        </Stack.Protected>
      </Stack>
    </BiometricGate>
  );
}

// Tema tercihine göre navigasyon renkleri, durum çubuğu ve açılış karşılaması
function ThemedApp() {
  const scheme = useScheme();
  const c = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = useMemo(() => ({
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.background, card: c.background, text: c.text, border: c.border },
  }), [base, c]);
  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <RootNavigator />
        <Welcome />
        <DialogHost />
      </AuthProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, err: any) => count < 2 && !(err?.status >= 400 && err?.status < 500),
      },
    },
  }));
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>
          <ThemedApp />
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
