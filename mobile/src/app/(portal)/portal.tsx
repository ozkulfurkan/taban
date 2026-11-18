import { Stack } from 'expo-router';
import { SettingsBody } from '@/components/settings';

// Müşteri portalı (katalog, siparişler, ekstre) sonraki adımda eklenecek; şimdilik hesap ve çıkış
export default function PortalHome() {
  return (
    <>
      <Stack.Screen options={{ title: 'Portal' }} />
      <SettingsBody />
    </>
  );
}
