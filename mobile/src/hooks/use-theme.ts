import { Colors, type Palette } from '@/constants/theme';
import { useThemePreference } from '@/core/theme-pref';

/** Etkin renk paleti: Ayarlar → Görünüm tercihine göre (varsayılan açık tema) */
export function useTheme(): Palette {
  return Colors[useThemePreference().scheme];
}

/** Etkin tema adı (yerel bileşenler için: tarih seçici, klavye, durum çubuğu) */
export const useScheme = () => useThemePreference().scheme;
