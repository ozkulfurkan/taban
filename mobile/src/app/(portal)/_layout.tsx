import { Stack } from 'expo-router';
import { TabStack } from '@/components/stack';

// Müşteri portalı: ana sayfa menüsü ve ekranlar tek yığında
export default function PortalLayout() {
  return (
    <TabStack>
      <Stack.Screen name="portal" options={{ headerShown: false }} />
    </TabStack>
  );
}
