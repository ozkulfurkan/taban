import { Stack, router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Empty, ErrorState, Field, ListRow, Loading, Segmented } from '@/components/ui';
import { useCanWrite } from '@/core/auth';
import { money } from '@/core/format';
import { balanceNote, type Employee } from '@/core/personnel';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';

// Personel listesi: çalışanlar / ayrılanlar, bakiye (personele borç / alacak)
export default function Personel() {
  const c = useTheme();
  const canWrite = useCanWrite();
  const [status, setStatus] = useState<'active' | 'left'>('active');
  const [search, setSearch] = useState('');
  const q2 = useDeferredValue(search.trim());
  const q = useApi<Employee[]>('/api/personnel', { status });
  const rows = useMemo(() => (q.data ?? []).filter(e => !q2 || matchesText(`${e.name} ${e.department} ${e.role}`, q2)), [q.data, q2]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Personel',
          headerRight: canWrite ? () => (
            <Pressable onPress={() => router.push('/personel/form')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Yeni personel" testID="employee-add">
              <Icon name="plus" size={22} color={c.primary} />
            </Pressable>
          ) : undefined,
          headerSearchBarOptions: { placeholder: 'Personel ara', onChangeText: e => setSearch(e.nativeEvent.text), hideWhenScrolling: false, placement: 'stacked' },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        data={q.isLoading || q.error ? [] : rows}
        keyExtractor={e => e.id}
        ListHeaderComponent={(
          <View style={{ padding: 16, gap: 12 }}>
            <Segmented value={status} onChange={setStatus} options={[{ value: 'active', label: 'Çalışanlar' }, { value: 'left', label: 'Ayrılanlar' }]} />
            {Platform.OS === 'web' ? <Field label="Ara" value={search} onChangeText={setSearch} placeholder="Ad, departman, görev" testID="employee-search" /> : null}
          </View>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error
          ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
          : <Empty message={status === 'active' ? 'Kayıtlı çalışan yok.' : 'Ayrılan personel yok.'} />}
        renderItem={({ item: e }) => {
          const b = e.balance ?? 0;
          return (
            <View style={{ backgroundColor: c.card }}>
              <ListRow
                testID={`employee-${e.id}`}
                title={e.name}
                subtitle={`${e.department} · ${e.role}`}
                right={money(b, e.currency)}
                rightSub={balanceNote(b)}
                rightColor={Math.abs(b) < 0.005 ? c.textSecondary : b > 0 ? c.danger : c.success}
                onPress={() => router.push(`/personel/${e.id}`)}
              />
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
      />
    </>
  );
}
