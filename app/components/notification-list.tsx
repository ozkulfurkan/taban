'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from '@/app/components/icons';
import { webUrlOf } from '@/lib/notification-link';
import { markRead, NotificationRows, type NotificationItem } from './notification-bell';

type Texts = { title: string; empty: string; markAll: string; more: string };

/** Tüm bildirimler sayfası (firma ve portal): yeniden eskiye, "Daha fazla" ile sayfalı */
export default function NotificationList({ portal, texts }: { portal: boolean; texts: Texts }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (before: string | null) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/notifications?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      const d = r.ok ? await r.json() : null;
      if (!d) return;
      setItems(list => (before ? [...(list ?? []), ...d.items] : d.items));
      setCursor(d.nextCursor);
      setUnread(d.unreadCount);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(null); }, [load]);

  const open = async (n: NotificationItem) => {
    if (!n.readAt) {
      const left = await markRead({ ids: [n.id] });
      if (left !== null) setUnread(left);
      setItems(list => list?.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
    }
    const href = webUrlOf(n.url, portal);
    if (href) router.push(href);
  };

  const markAll = async () => {
    const left = await markRead({ all: true });
    if (left !== null) setUnread(left);
    setItems(list => list?.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2"><Bell className="w-5 h-5" /> {texts.title}</h1>
        {unread > 0 && (
          <button onClick={markAll} className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800" data-testid="notifications-mark-all">
            <CheckCheck className="w-4 h-4" /> {texts.markAll}
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-card overflow-hidden border border-ink-200/80" data-testid="notification-list">
        {items === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-ink-400 py-12">{texts.empty}</p>
        ) : (
          <NotificationRows items={items} onClick={open} />
        )}
      </div>
      {cursor && (
        <div className="flex justify-center">
          <button onClick={() => load(cursor)} disabled={busy}
            className="px-4 py-2 rounded-lg bg-white border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : texts.more}
          </button>
        </div>
      )}
    </div>
  );
}
