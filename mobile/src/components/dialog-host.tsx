import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { setDialogListener, type DialogRequest, type Tone } from '@/core/dialog';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';
import { T } from './ui';

// Uygulamanın temalı uyarı penceresi ve kısa bildirimi (core/dialog çağrılarını gösterir).
// Pencereler sırayla açılır; başarı bildirimi pencereyi beklemeden üstte görünür.

const TOAST_MS = 2200;
type Modalish = Exclude<DialogRequest, { kind: 'notify'; tone: 'success' }>;

export function DialogHost() {
  const [queue, setQueue] = useState<Modalish[]>([]);
  const [toast, setToast] = useState<{ id: number; title: string; message: string } | null>(null);

  useEffect(() => {
    setDialogListener(r => {
      if (r.kind === 'notify' && r.tone === 'success') setToast({ id: r.id, title: r.title, message: r.message });
      else setQueue(q => [...q, r as Modalish]);
    });
    return () => setDialogListener(null);
  }, []);

  const current = queue[0] ?? null;
  const done = useCallback((value: boolean) => {
    setQueue(q => {
      const [head, ...rest] = q;
      if (head?.kind === 'confirm') head.resolve(value);
      return rest;
    });
  }, []);

  return (
    <>
      <DialogCard request={current} onDone={done} />
      <Toast toast={toast} onHide={() => setToast(null)} />
    </>
  );
}

const TONE_ICON: Record<Tone, IconName> = { success: 'check', error: 'alert', info: 'info' };

function DialogCard({ request, onDone }: { request: Modalish | null; onDone: (v: boolean) => void }) {
  const c = useTheme();
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!request) return;
    scale.value = 0.92; opacity.value = 0;
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 160 });
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (!request) return null;
  const isConfirm = request.kind === 'confirm';
  const tone: Tone = isConfirm ? (request.destructive ? 'error' : 'info') : request.tone;
  const fg = tone === 'error' ? c.danger : tone === 'success' ? c.success : c.primary;
  const bg = tone === 'error' ? c.dangerSoft : tone === 'success' ? c.successSoft : c.primarySoft;
  const cancel = () => onDone(false);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={isConfirm ? cancel : () => onDone(true)} accessibilityLabel="Kapat" />
        <Animated.View style={[styles.card, { backgroundColor: c.card, shadowColor: c.shadow }, cardStyle]} testID="dialog">
          <View style={[styles.icon, { backgroundColor: bg }]}>
            <Icon name={isConfirm && request.destructive ? 'trash' : TONE_ICON[tone]} size={26} color={fg} />
          </View>
          <T variant="heading" style={{ textAlign: 'center' }}>{request.title}</T>
          {request.message ? <T style={{ textAlign: 'center', color: c.textSecondary }}>{request.message}</T> : null}
          <View style={styles.buttons}>
            {isConfirm ? (
              <>
                <DialogButton label="Vazgeç" onPress={cancel} color={c.text} bg={c.background} border={c.border} testID="dialog-cancel" />
                <DialogButton label={request.ok} onPress={() => onDone(true)} color="#fff"
                  bg={request.destructive ? c.danger : c.primary} testID="dialog-ok" />
              </>
            ) : (
              <DialogButton label="Tamam" onPress={() => onDone(true)} color="#fff" bg={tone === 'error' ? c.danger : c.primary} testID="dialog-ok" />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DialogButton({ label, onPress, color, bg, border, testID }: {
  label: string; onPress: () => void; color: string; bg: string; border?: string; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: border ?? bg, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ color, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Toast({ toast, onHide }: { toast: { id: number; title: string; message: string } | null; onHide: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-120);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    y.set(withTiming(-120, { duration: 220, easing: Easing.in(Easing.quad) }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onHide, 230);
  }, [onHide, y]);

  useEffect(() => {
    if (!toast) return;
    y.set(withSpring(0, { damping: 18, stiffness: 200 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, TOAST_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [toast?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (!toast) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + 8 }, style]}>
      <Pressable onPress={hide} accessibilityRole="alert" testID="toast"
        style={[styles.toast, { backgroundColor: c.strong, shadowColor: c.shadow }]}>
        <View style={styles.toastIcon}><Icon name="check" size={20} color={c.strongPositive} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T color={c.strongText} style={{ fontWeight: '700' }} numberOfLines={1}>{toast.title}</T>
          {toast.message ? <T variant="small" color={c.strongMuted} numberOfLines={2}>{toast.message}</T> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,8,12,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  card: {
    width: '100%', maxWidth: 360, borderRadius: 24, padding: Spacing.four, gap: Spacing.two, alignItems: 'center',
    shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: Spacing.two },
  button: { flex: 1, minHeight: 46, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  toastWrap: { position: 'absolute', left: 12, right: 12, zIndex: 2000, elevation: 2000, alignItems: 'center' },
  toast: {
    width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  toastIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
