import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
import { STAFF_TABS } from './tabs';

// Web önizlemesi için alt sekme çubuğu (native'de sistem sekmeleri kullanılır)
export default function AppTabs() {
  const c = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        {STAFF_TABS.map(t => (
          <TabTrigger key={t.name} name={t.name} href={t.href as any} asChild>
            <TabButton label={t.label} icon={t.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({ label, icon, isFocused, ...props }: any) {
  const c = useTheme();
  const color = isFocused ? c.primary : c.textSecondary;
  return (
    <Pressable {...props} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Icon name={icon} size={22} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: isFocused ? '600' : '500' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 6, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', paddingVertical: 4 },
});
