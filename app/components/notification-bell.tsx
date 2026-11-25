'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from '@/app/components/icons';
import { timeAgo, webUrlOf } from '@/lib/notification-link';

export const POLL_MS = 120_000;

export type NotificationItem = { id: string; title: string; body: string; url: string | null; readAt: string | null; createdAt: string };

type Texts = { title: string; empty: string; markAll: string; seeAll: string };
const TR: Texts = { title: 'Bildirimler', empty: 'Henüz bildirim yok', markAll: 'Tümünü okundu yap', seeAll: 'Tümünü gör' };

export async function markRead(body: { ids: string[] } | { all: true }): Promise<number | null> {
  const r = await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const d = r?.ok ? await r.json().catch(() => null) : null;
  return typeof d?.unreadCount === 'number' ? d.unreadCount : null;
}

/** Üst bardaki zil: okunmamış sayısı, son bildirimler, tıklayınca ilgili sayfa */
export default function NotificationBell({ portal = false, texts = TR }: { portal?: boolean; texts?: Texts }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const load = useCallback(async (withItems: boolean) => {
    const r = await fetch(`/api/notifications?limit=${withItems ? 10 : 1}`).catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => null);
    if (!d) return;
    setUnread(d.unreadCount ?? 0);
    if (withItems) setItems(d.items ?? []);
  }, []);

  useEffect(() => {
    void load(false);
    // 2 dakikada bir (yalnızca görünür sekmede); sekmeye dönünce hemen yenilenir. Sunucu ve veritabanı yükünü azaltır
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(false); }, POLL_MS);
    const onFocus = () => void load(false);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = () => {
    if (!open) { setItems(null); void load(true); }
    setOpen(o => !o);
  };

  const go = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.readAt) {
      const left = await markRead({ ids: [n.id] });
      if (left !== null) setUnread(left);
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
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-label={texts.title} aria-expanded={open} data-testid="notification-bell"
        className="relative p-2 rounded-lg text-ink-600 hover:bg-ink-100 transition-colors">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span data-testid="notification-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-xl shadow-lg border border-ink-200 z-50 overflow-hidden" data-testid="notification-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
            <span className="font-semibold text-ink-800 text-sm">{texts.title}</span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
                <CheckCheck className="w-3.5 h-3.5" /> {texts.markAll}
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items === null ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-ink-400" /></div>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-ink-400 py-8">{texts.empty}</p>
            ) : (
              <NotificationRows items={items} onClick={go} />
            )}
          </div>
          <Link href={portal ? '/portal/bildirimler' : '/bildirimler'} onClick={() => setOpen(false)}
            className="block text-center text-sm font-medium text-brand-700 hover:bg-ink-50 py-2.5 border-t border-ink-100">
            {texts.seeAll}
          </Link>
        </div>
      )}
    </div>
  );
}

export function NotificationRows({ items, onClick }: { items: NotificationItem[]; onClick: (n: NotificationItem) => void }) {
  return (
    <ul className="divide-y divide-ink-100">
      {items.map(n => (
        <li key={n.id}>
          <button onClick={() => onClick(n)} data-testid="notification-row"
            className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-ink-50 transition-colors ${n.readAt ? '' : 'bg-brand-50/50'}`}>
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-brand-700'}`} />
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`text-sm truncate ${n.readAt ? 'text-ink-700' : 'font-semibold text-ink-900'}`}>{n.title}</span>
                <span className="text-[11px] text-ink-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
              </span>
              <span className="block text-xs text-ink-500 mt-0.5 line-clamp-2">{n.body}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
