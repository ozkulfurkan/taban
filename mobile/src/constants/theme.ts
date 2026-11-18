import '@/global.css';

import { Platform } from 'react-native';

// SoleCost renkleri (web uygulamasıyla uyumlu: mavi ana renk, slate griler)
export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    background: '#F1F5F9',
    card: '#FFFFFF',
    border: '#E2E8F0',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    primarySoft: '#DBEAFE',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    success: '#059669',
    successSoft: '#D1FAE5',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    strong: '#1E293B',
    strongText: '#FFFFFF',
  },
  dark: {
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    background: '#0B1120',
    card: '#111827',
    border: '#1F2937',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    primarySoft: '#1E3A8A',
    danger: '#F87171',
    dangerSoft: '#450A0A',
    success: '#34D399',
    successSoft: '#064E3B',
    warning: '#FBBF24',
    warningSoft: '#451A03',
    strong: '#E2E8F0',
    strongText: '#0F172A',
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
