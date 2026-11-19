import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';
import { T } from './ui';

export type SheetAction = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void; testID?: string };

/**
 * Seçenek listesi (Android'deki 3 düğme sınırı olmadan). Varsayılan alttan açılır;
 * "top" ekranın üstünden açılır (alttaki sekme çubuğunun arkasında kalmaması için).
 */
export function Sheet({ visible, onClose, title, description, actions, children, placement = 'bottom' }: {
  visible: boolean; onClose: () => void; title: string; description?: string; actions: SheetAction[]; children?: ReactNode;
  placement?: 'bottom' | 'top';
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const top = placement === 'top';
  const backdrop = <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />;
  return (
    <Modal visible={visible} transparent animationType={top ? 'fade' : 'slide'} onRequestClose={onClose}>
      {top ? null : backdrop}
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.card },
          top
            ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg, paddingTop: insets.top + Spacing.three }
            : { paddingBottom: insets.bottom + Spacing.three },
        ]}
        testID="sheet"
      >
        {top ? null : <View style={[styles.grabber, { backgroundColor: c.border }]} />}
        <T variant="heading">{title}</T>
        {description ? <T variant="small">{description}</T> : null}
        {children}
        <View style={{ marginTop: Spacing.two }}>
          {actions.map(a => (
            <Pressable
              key={a.label}
              testID={a.testID}
              accessibilityRole="button"
              onPress={() => { onClose(); a.onPress(); }}
              style={({ pressed }) => [styles.action, { borderTopColor: c.border }, pressed && { opacity: 0.6 }]}
            >
              {a.icon ? <Icon name={a.icon} color={a.destructive ? c.danger : c.primary} /> : null}
              <T color={a.destructive ? c.danger : c.text} style={{ fontWeight: '500' }}>{a.label}</T>
            </Pressable>
          ))}
          <Pressable onPress={onClose} accessibilityRole="button" style={[styles.action, { borderTopColor: c.border, justifyContent: 'center' }]}>
            <T color={c.textSecondary}>Vazgeç</T>
          </Pressable>
        </View>
      </View>
      {top ? backdrop : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
