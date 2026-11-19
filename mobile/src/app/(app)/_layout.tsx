import { Stack } from 'expo-router';
import { TabStack } from '@/components/stack';

// Firma uygulaması: ana sayfa menüsü (panel) ve tüm ekranlar tek yığında.
// Geri tuşu her zaman gelinen ekrana döner.
export default function AppLayout() {
  return (
    <TabStack>
      <Stack.Screen name="panel/index" options={{ headerShown: false }} />
    </TabStack>
  );
}
