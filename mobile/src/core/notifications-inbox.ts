import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

// Bildirim kutusu (web ile aynı API): liste, okunmamış sayısı ve okundu işareti.
// Push gelince NotificationBridge tüm sorguları yeniler; rozet de güncellenir.

export type InboxItem = { id: string; title: string; body: string; url: string | null; readAt: string | null; createdAt: string };
type Page = { items: InboxItem[]; unreadCount: number; nextCursor: string | null };

export const INBOX_KEY = ['notifications'] as const;

export function useInbox() {
  return useInfiniteQuery({
    queryKey: [...INBOX_KEY, 'list'],
    queryFn: ({ pageParam, signal }) => api<Page>('/api/notifications', { query: { limit: 30, before: pageParam ?? undefined }, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...INBOX_KEY, 'unread'],
    queryFn: ({ signal }) => api<Page>('/api/notifications', { query: { limit: 1 }, signal }),
    select: d => d.unreadCount,
    refetchInterval: 120_000, // web zil ile aynı: 2 dakikada bir, yalnızca uygulama öndeyken
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return async (body: { ids: string[] } | { all: true }) => {
    await api<{ unreadCount: number }>('/api/notifications/read', { method: 'POST', body });
    await qc.invalidateQueries({ queryKey: INBOX_KEY });
  };
}
