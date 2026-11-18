import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';
import { T } from './ui';

export type SheetAction = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void; testID?: string };

/** Alttan açılan seçenek listesi (Android'deki 3 düğme sınırı olmadan) */
export function Sheet({ visible, onClose, title, description, actions, children }: {
  visible: boolean; onClose: () => void; title: string; description?: string; actions: SheetAction[]; children?: ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
      <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + Spacing.three }]} testID="sheet">
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
