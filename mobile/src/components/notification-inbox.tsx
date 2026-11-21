import { Stack, router, type Href } from 'expo-router';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Empty, ErrorState, Loading, T } from '@/components/ui';
import { notify } from '@/core/dialog';
import { useInbox, useMarkRead, type InboxItem } from '@/core/notifications-inbox';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@shared/notification-link';

/** Bildirimler ekranı (firma ve portal): yeniden eskiye, kaydırdıkça devamı yüklenir */
export function NotificationInbox() {
  const c = useTheme();
  const q = useInbox();
  const markRead = useMarkRead();
  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  const unread = q.data?.pages[0]?.unreadCount ?? 0;

  const open = (n: InboxItem) => {
    if (!n.readAt) void markRead({ ids: [n.id] }).catch(() => {});
    if (n.url?.startsWith('/')) router.push(n.url as Href);
  };
  const markAll = () => { markRead({ all: true }).catch(e => notify('Bildirimler', e?.message || 'İşlem yapılamadı')); };

  return (
    <>
      <Stack.Screen options={{
        title: 'Bildirimler',
        headerRight: unread > 0 ? () => (
          <Pressable onPress={markAll} hitSlop={10} accessibilityRole="button" accessibilityLabel="Tümünü okundu yap" testID="inbox-mark-all"
            style={Platform.OS === 'web' ? { paddingRight: 16 } : undefined}>
            <T color={c.primary} style={{ fontWeight: '600' }}>Tümü okundu</T>
          </Pressable>
        ) : undefined,
      }} />
      {q.isLoading ? <Loading /> : q.isError && !items.length ? (
        <ErrorState message={(q.error as Error)?.message || 'Bildirimler alınamadı'} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          style={{ backgroundColor: c.background }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} />}
          ListEmptyComponent={<Empty message="Henüz bildirim yok. Sipariş bildirimleri burada listelenir." />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
          renderItem={({ item: n }) => (
            <Pressable onPress={() => open(n)} testID="inbox-row"
              style={({ pressed }) => [styles.row, { backgroundColor: n.readAt ? c.card : c.primarySoft }, pressed && { opacity: 0.7 }]}>
              <View style={[styles.dot, { backgroundColor: n.readAt ? 'transparent' : c.primary }]} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={styles.top}>
                  <T numberOfLines={1} style={{ flex: 1, fontWeight: n.readAt ? '400' : '700' }}>{n.title}</T>
                  <T variant="small">{timeAgo(n.createdAt)}</T>
                </View>
                <T variant="small" numberOfLines={3}>{n.body}</T>
              </View>
              {n.url ? <Icon name="chevron" size={14} color={c.textSecondary} /> : null}
            </Pressable>
          )}
        />
      )}
    </>
  );
}

/** Başlıktaki zil: okunmamış bildirim sayısı rozetiyle */
export function BellButton({ href, color, background, border, unread }: { href: Href; color: string; background: string; border: string; unread: number }) {
  const c = useTheme();
  return (
    <Pressable onPress={() => router.push(href)} hitSlop={10} accessibilityRole="button"
      accessibilityLabel={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'} testID="bell"
      style={[styles.round, { backgroundColor: background, borderColor: border }]}>
      <Icon name="bell" size={20} color={color} />
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: c.danger }]} testID="bell-badge">
          <T color="#fff" style={{ fontSize: 11, fontWeight: '700' }}>{unread > 99 ? '99+' : unread}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
});
