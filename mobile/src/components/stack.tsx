import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

// Sekme içi gezinme: büyük başlıklı native yığın
export function TabStack() {
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
    />
  );
}
