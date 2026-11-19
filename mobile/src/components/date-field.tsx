import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
import { Field, T } from './ui';
import { dateFromIso, displayDate, isoFromDate, isoFromDisplay } from '@/core/dates';

export { dateFromIso, displayDate, isoFromDate, isoFromDisplay };

// Tarih alanı: değer API biçiminde (YYYY-AA-GG) tutulur, ekranda GG.AA.YYYY görünür, klavye yerine takvimden seçilir.
// iOS: takvim alanın altında açılır (Modal açmaz; sayfa ya da pencere içinde aynı çalışır). Android: sistem tarih penceresi.

export function DateField({ label, value, onChange, optional, placeholder, minimumDate, testID }: {
  label: string;
  /** "YYYY-AA-GG" ya da boş */
  value: string;
  onChange: (iso: string) => void;
  /** Boş bırakılabilir: "Temizle" gösterilir */
  optional?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  testID?: string;
}) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const [webText, setWebText] = useState(displayDate(value));
  const current = dateFromIso(value) ?? new Date();

  // Web önizlemesi: yerel takvim yok, GG.AA.YYYY elle yazılır
  if (Platform.OS === 'web') {
    return (
      <Field label={label} value={webText} placeholder={placeholder ?? 'GG.AA.YYYY'} testID={testID}
        onChangeText={t => { setWebText(t); const iso = isoFromDisplay(t); if (iso) onChange(iso); else if (!t.trim() && optional) onChange(''); }} />
    );
  }

  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current, mode: 'date', minimumDate,
        onValueChange: (_e, d) => onChange(isoFromDate(d)),
      });
      return;
    }
    setOpen(o => !o);
  };

  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? displayDate(value) : 'seçilmedi'}`}
        accessibilityState={{ expanded: open }}
        testID={testID}
        style={({ pressed }) => [styles.box, { backgroundColor: c.card, borderColor: open ? c.primary : c.border }, pressed && { opacity: 0.7 }]}
      >
        <Icon name="calendar" size={18} color={c.primary} />
        <T style={{ flex: 1, fontSize: 16 }} color={value ? c.text : c.textMuted}>
          {value ? displayDate(value) : placeholder ?? 'Tarih seçin'}
        </T>
        {optional && value ? (
          <Pressable onPress={() => { onChange(''); setOpen(false); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${label} temizle`}>
            <T color={c.danger} variant="small">Temizle</T>
          </Pressable>
        ) : null}
      </Pressable>
      {open ? (
        <View style={[styles.calendar, { backgroundColor: c.card, borderColor: c.border }]}>
          <DateTimePicker
            value={current}
            mode="date"
            display="inline"
            locale="tr-TR"
            minimumDate={minimumDate}
            accentColor={c.primary}
            onValueChange={(_e, d) => { onChange(isoFromDate(d)); setOpen(false); }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  calendar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
});
