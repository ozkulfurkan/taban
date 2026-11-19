import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';
import { Icon } from './icon';
import { Empty, ListRow, Loading, T } from './ui';

export type PickerItem = { id: string; title: string; subtitle?: string; right?: string; search?: string };

/** Tam ekran arama listesi (cari, ürün, hammadde seçimi) */
export function Picker({ visible, title, items, loading, onPick, onClose, emptyText = 'Kayıt yok.' }: {
  visible: boolean; title: string; items: PickerItem[]; loading?: boolean;
  onPick: (id: string) => void; onClose: () => void; emptyText?: string;
}) {
  const c = useTheme();
  const [q, setQ] = useState('');
  const shown = useMemo(
    () => (q.trim() ? items.filter(i => matchesText(`${i.title} ${i.subtitle ?? ''} ${i.search ?? ''}`, q.trim())) : items).slice(0, 300),
    [items, q],
  );
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <T variant="heading" style={{ flex: 1 }}>{title}</T>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <T color={c.primary}>Kapat</T>
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Icon name="search" size={18} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Ara"
            placeholderTextColor={c.textMuted}
            autoFocus
            autoCorrect={false}
            style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 }}
            accessibilityLabel={`${title} ara`}
            testID="picker-search"
          />
        </View>
        {loading ? <Loading /> : (
          <FlatList
            data={shown}
            keyExtractor={i => i.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Empty message={q ? 'Aramaya uyan kayıt yok.' : emptyText} />}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: c.card }}>
                <ListRow title={item.title} subtitle={item.subtitle} right={item.right} onPress={() => { setQ(''); onPick(item.id); }} testID={`pick-${item.id}`} />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: Spacing.two },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.three, marginBottom: Spacing.two,
    paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
});
