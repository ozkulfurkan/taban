import { Stack } from 'expo-router';
import { SettingsBody } from '@/components/settings';

export default function PortalAyarlar() {
  return (
    <>
      <Stack.Screen options={{ title: 'Ayarlar' }} />
      <SettingsBody />
    </>
  );
}
