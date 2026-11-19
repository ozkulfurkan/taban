import type { ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';

type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'small' | 'money' | 'moneyLarge';

export function T({ variant = 'body', color, style, children, numberOfLines, testID, fit }: {
  variant?: TextVariant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; testID?: string;
  /** Tek satıra sığdırmak için yazıyı küçült (uzun tutarlar) */
  fit?: boolean;
}) {
  const c = useTheme();
  const base = text[variant];
  const defaultColor = variant === 'small' || variant === 'label' ? c.textSecondary : c.text;
  return (
    <Text
      testID={testID}
      numberOfLines={fit ? 1 : numberOfLines}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.55 : undefined}
      style={[base, { color: color ?? defaultColor }, fit && Platform.OS === 'web' ? ({ fontSize: 14 } as TextStyle) : null, style]}
    >
      {children}
    </Text>
  );
}

/** Kaydırılabilir sayfa; çekip yenileme destekli. Klavye açılınca odaktaki alan klavyenin üstüne kayar
 * (iOS: kaydırma payı otomatik; Android: kenardan kenara düzende pencere küçülmediği için KeyboardAvoidingView). */
export function Screen({ children, refreshing, onRefresh, scroll = true, padded = true, edges }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const c = useTheme();
  const inner = <View style={[styles.content, padded && styles.padded]}>{children}</View>;
  const body = scroll ? (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {inner}
    </ScrollView>
  ) : inner;
  return (
    <SafeAreaView edges={edges ?? ['left', 'right']} style={{ flex: 1, backgroundColor: c.background }}>
      {Platform.OS === 'android' ? <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>{body}</KeyboardAvoidingView> : body}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const c = useTheme();
  const s = [styles.card, { backgroundColor: c.card, borderColor: c.border }, style];
  if (!onPress) return <View testID={testID} style={s}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, testID }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: IconName;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const c = useTheme();
  const bg = { primary: c.primary, secondary: c.card, danger: c.danger, ghost: 'transparent' }[variant];
  const fg = { primary: c.primaryText, secondary: c.text, danger: '#fff', ghost: c.primary }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? c.border : 'transparent', opacity: off ? 0.55 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, error, style, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={c.textMuted}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: error ? c.danger : c.border }, style]}
      />
      {error ? <T variant="small" color={c.danger}>{error}</T> : null}
    </View>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: {
  value: V; options: { value: V; label: string }[]; onChange: (v: V) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.border }]} accessibilityRole="tablist">
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, on && { backgroundColor: c.card }]}
          >
            <Text style={{ color: on ? c.text : c.textSecondary, fontWeight: on ? '600' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ListRow({ title, subtitle, right, rightSub, onPress, rightColor, testID }: {
  title: string; subtitle?: string; right?: string; rightSub?: string; onPress?: () => void; rightColor?: string; testID?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.border }, pressed && onPress ? { backgroundColor: c.background } : null]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontWeight: '600' }}>{title}</T>
        {subtitle ? <T variant="small" numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <T variant="money" color={rightColor}>{right}</T>
          {rightSub ? <T variant="small">{rightSub}</T> : null}
        </View>
      ) : null}
      {onPress ? <Icon name="chevron" size={14} color={c.textMuted} /> : null}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'primary' }) {
  const c = useTheme();
  const map = {
    neutral: [c.border, c.textSecondary], danger: [c.dangerSoft, c.danger], warning: [c.warningSoft, c.warning],
    success: [c.successSoft, c.success], primary: [c.primarySoft, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  const c = useTheme();
  return <View style={styles.center}><ActivityIndicator color={c.primary} size="large" /></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.center, { gap: 12 }]}>
      <Icon name="alert" size={28} color={c.warning} />
      <T style={{ textAlign: 'center' }}>{message}</T>
      {onRetry ? <Button title="Tekrar dene" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return <View style={styles.center}><T variant="small" style={{ textAlign: 'center' }}>{message}</T></View>;
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="label" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</T>
        {action}
      </View>
      {children}
    </View>
  );
}

const text: Record<TextVariant, TextStyle> = {
  title: { fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: '500' },
  small: { fontSize: 13 },
  money: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  moneyLarge: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  padded: { padding: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, minHeight: 46, borderRadius: Radius.md, borderWidth: 1,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, minHeight: 200 },
});
