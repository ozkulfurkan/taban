import '@/global.css';

import { Platform } from 'react-native';

// SoleCost mobil kimliği: bordo ve beyaz. Varsayılan açık tema (Ayarlar → Görünüm'den Koyu / Sistem seçilebilir).
// "strong" = bordo vurgu kartı (bakiye, özet); üzerindeki yazılar strongText / strongMuted / strongPositive / strongNegative
// token'larıyla verilir, sabit renk kullanılmaz (her iki temada okunur).
export const Colors = {
  light: {
    text: '#1F1418',
    textSecondary: '#6B5A60',
    textMuted: '#A3929A',
    background: '#FAF6F6',
    card: '#FFFFFF',
    border: '#EDE2E5',
    primary: '#7B1E34',
    primaryText: '#FFFFFF',
    primarySoft: '#F6E6EA',
    danger: '#C81E1E',
    dangerSoft: '#FDE8E8',
    success: '#047857',
    successSoft: '#DCF5EA',
    warning: '#B45309',
    warningSoft: '#FDF1DC',
    strong: '#6B1A2C',
    strongText: '#FFFFFF',
    strongMuted: 'rgba(255,255,255,0.78)',
    strongPositive: '#86EFAC',
    strongNegative: '#FCD34D',
    shadow: '#4A0E1C',
  },
  dark: {
    text: '#F6EEF0',
    textSecondary: '#C2ADB3',
    textMuted: '#8C767D',
    background: '#140C0F',
    card: '#1F1519',
    border: '#35252B',
    primary: '#D2486A',
    primaryText: '#FFFFFF',
    primarySoft: '#3D1822',
    danger: '#F87171',
    dangerSoft: '#451414',
    success: '#4ADE80',
    successSoft: '#0F3321',
    warning: '#FBBF24',
    warningSoft: '#3D2A08',
    strong: '#5A1626',
    strongText: '#FFFFFF',
    strongMuted: 'rgba(255,255,255,0.75)',
    strongPositive: '#86EFAC',
    strongNegative: '#FCD34D',
    shadow: '#000000',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)' },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { sm: 8, md: 12, lg: 16 } as const;
export const MaxContentWidth = 720;
