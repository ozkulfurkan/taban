import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setSubscriptionRequiredHandler } from '@/core/api';
import { AuthProvider, useAuth } from '@/core/auth';
import { confirm } from '@/core/dialog';
import { BiometricGate } from '@/core/biometric';

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

  // Abonelik süresi dolmuş firmada yazma denenince: tek seferde bir uyarı, "Abone ol" ile abonelik ekranı
  useEffect(() => {
    let open = false;
    setSubscriptionRequiredHandler(message => {
      if (open || user?.type !== 'staff') return;
      open = true;
      void confirm('Abonelik gerekli', message, 'Abone ol').then(ok => {
        open = false;
        if (ok) router.push('/abonelik');
      });
    });
    return () => setSubscriptionRequiredHandler(null);
  }, [user?.type]);

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

export default function RootLayout() {
  const scheme = useColorScheme();
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
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
