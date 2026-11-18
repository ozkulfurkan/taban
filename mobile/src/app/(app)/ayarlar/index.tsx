import { Stack } from 'expo-router';
import { SettingsBody } from '@/components/settings';

export default function Ayarlar() {
  return (
    <>
      <Stack.Screen options={{ title: 'Ayarlar' }} />
      <SettingsBody />
    </>
  );
}
