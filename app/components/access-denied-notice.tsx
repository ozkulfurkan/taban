'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, X } from '@/app/components/icons';

// Bir API isteği yetki nedeniyle (403) reddedildiğinde kullanıcıya sebebini gösterir.
// Ekranlardaki silme/kaydetme düğmeleri rol bilmediği için, bu olmadan istek
// sessizce başarısız olur ve kullanıcı ne olduğunu anlamaz.
export function AccessDeniedNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const original = window.fetch;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const patched: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (res.status === 403 && url.includes('/api/')) {
          const body = await res.clone().json().catch(() => null);
          setMessage(body?.error || 'Bu işlem için yetkiniz yok');
          clearTimeout(timer);
          timer = setTimeout(() => setMessage(null), 5000);
        }
      } catch {
        // bildirim gösterilemese de isteğin sonucu değişmez
      }
      return res;
    };

    window.fetch = patched;
    return () => {
      if (window.fetch === patched) window.fetch = original;
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div role="alert"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 max-w-[calc(100vw-32px)] rounded-xl bg-ink-900 text-white px-4 py-3 shadow-xl text-sm">
      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
      <span>{message}</span>
      <button onClick={() => setMessage(null)} aria-label="Kapat" className="text-ink-400 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
