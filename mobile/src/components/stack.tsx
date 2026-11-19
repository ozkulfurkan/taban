import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { useTheme } from '@/hooks/use-theme';

// Uygulama içi gezinme: tek native yığın (alt sekme yok; ana sayfa menüsünden açılır)
export function TabStack({ children }: { children?: ReactNode }) {
  const c = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.primary,
        headerTitleStyle: { color: c.text },
        headerLargeTitleStyle: { color: c.text },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: c.background },
      }}
    >
      {children}
    </Stack>
  );
}
