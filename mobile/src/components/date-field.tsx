import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
import { Field, T } from './ui';
import { dateFromIso, displayDate, isoFromDate, isoFromDisplay } from '@/core/dates';

export { dateFromIso, displayDate, isoFromDate, isoFromDisplay };

// Tarih alanı: değer API biçiminde (YYYY-AA-GG) tutulur, ekranda GG.AA.YYYY görünür, klavye yerine takvimden seçilir.
// iOS: takvim alttan açılan tam genişlik panelde (alan dar bir sütunda olsa da sığar). Android: sistem tarih penceresi.

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
  const insets = useSafeAreaInsets();
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
      {/* Takvim alttan açılan tam genişlik panelde: alan yarım genişlikte (ör. Tutar | Vade) olsa da sığar */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Kapat" />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 12 }]} testID={testID ? `${testID}-sheet` : undefined}>
          <View style={styles.sheetHead}>
            <T variant="heading">{label}</T>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button"><T color={c.primary}>Kapat</T></Pressable>
          </View>
          <DateTimePicker
            value={current}
            mode="date"
            display="inline"
            locale="tr-TR"
            minimumDate={minimumDate}
            accentColor={c.primary}
            style={{ alignSelf: 'stretch' }}
            onValueChange={(_e, d) => { onChange(isoFromDate(d)); setOpen(false); }}
          />
          <View style={styles.sheetActions}>
            {!minimumDate || new Date() >= minimumDate ? (
              <Pressable onPress={() => { onChange(isoFromDate(new Date())); setOpen(false); }} hitSlop={8} accessibilityRole="button">
                <T color={c.primary} style={{ fontWeight: '600' }}>Bugün</T>
              </Pressable>
            ) : <View />}
            {optional && value ? (
              <Pressable onPress={() => { onChange(''); setOpen(false); }} hitSlop={8} accessibilityRole="button">
                <T color={c.danger} style={{ fontWeight: '600' }}>Temizle</T>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});
