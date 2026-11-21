import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/core/auth';

// Açılış karşılaması: bordo zeminde logo ölçeklenerek gelir, ad ve karşılama yazısı kayarak belirir.
// Yalnızca soğuk açılışta (uygulama süreci başlarken) gösterilir, ~2 sn sürer, dokununca hemen geçer.
// Splash ekranı da aynı bordo zemindedir (app.json), geçiş kesintisizdir.

let shownThisLaunch = false;
const BRAND = Colors.light.strong;
const TOTAL_MS = 1900;
const FADE_MS = 320;

export function Welcome() {
  const { ready, user } = useAuth();
  const [visible, setVisible] = useState(!shownThisLaunch);

  const logo = useSharedValue(0);
  const title = useSharedValue(0);
  const subtitle = useSharedValue(0);
  const overlay = useSharedValue(1);

  const close = () => {
    overlay.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
    setTimeout(() => setVisible(false), FADE_MS);
  };

  useEffect(() => {
    if (!visible || !ready) return; // oturum yüklenince başla (adıyla karşılamak için)
    shownThisLaunch = true;
    const ease = Easing.out(Easing.cubic);
    logo.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.back(1.6)) });
    title.value = withDelay(260, withTiming(1, { duration: 480, easing: ease }));
    subtitle.value = withDelay(480, withTiming(1, { duration: 480, easing: ease }));
    const t = setTimeout(close, TOTAL_MS - FADE_MS);
    return () => clearTimeout(t);
  }, [visible, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logo.value, transform: [{ scale: 0.6 + logo.value * 0.4 }] }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: title.value, transform: [{ translateY: (1 - title.value) * 18 }] }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitle.value, transform: [{ translateY: (1 - subtitle.value) * 14 }] }));

  if (!visible) return null;
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlayStyle]} testID="welcome">
      <Pressable style={styles.fill} onPress={close} accessibilityRole="button" accessibilityLabel="Karşılamayı geç">
        <Animated.View style={[styles.logo, logoStyle]}>
          <Text style={styles.logoText}>SC</Text>
        </Animated.View>
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>SoleCost</Text>
        </Animated.View>
        <Animated.View style={[{ alignItems: 'center', gap: 6 }, subtitleStyle]}>
          <Text style={styles.greeting}>{firstName ? `Hoş geldiniz, ${firstName}` : 'Hoş geldiniz'}</Text>
          <Text style={styles.subtitle}>Taban üretiminde maliyet, cari ve sipariş</Text>
        </Animated.View>
        <View style={styles.bar} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BRAND, zIndex: 1000, elevation: 1000 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 },
  logo: {
    width: 104, height: 104, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  logoText: { color: BRAND, fontSize: 40, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: 0.5 },
  greeting: { color: '#FFFFFF', fontSize: 19, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 14, textAlign: 'center' },
  bar: { position: 'absolute', bottom: 56, width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
});
