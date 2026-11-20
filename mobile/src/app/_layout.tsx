import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/core/auth';
import { BiometricGate } from '@/core/biometric';
import { ThemePreferenceProvider } from '@/core/theme-pref';
import { Welcome } from '@/components/welcome';
import { useScheme, useTheme } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready, user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  // Bildirime dokununca ilgili sipariş açılır (uygulama kapalıyken dokunulduysa oturum hazır olunca)
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (!ready || !user || typeof url !== 'string' || !url.startsWith('/')) return;
    router.push(url as Href);
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, ready, user]);

  // Uygulama açıkken bildirim gelince sipariş listeleri yenilensin
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => { void qc.invalidateQueries(); });
    return () => sub.remove();
  }, [qc]);

  if (!ready) return null;
  const staff = user?.type === 'staff';
  const portal = user?.type === 'portal';
  return (
    <BiometricGate active={!!user}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
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
