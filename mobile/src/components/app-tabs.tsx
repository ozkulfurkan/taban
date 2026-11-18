import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@/hooks/use-theme';
import { tabIcon } from './icon';
import { STAFF_TABS } from './tabs';

export default function AppTabs() {
  const c = useTheme();
  return (
    <NativeTabs tintColor={c.primary} backgroundColor={c.card}>
      {STAFF_TABS.map(t => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon {...tabIcon(t.icon)} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
