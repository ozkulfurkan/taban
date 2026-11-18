'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

// Kaydedilmemiş değişiklik varken sayfadan çıkılırsa sorar:
// - sekme kapatma / yenileme: tarayıcının kendi uyarısı (beforeunload)
// - uygulama içi bağlantılar (<a href>): onay penceresi
// - sayfanın kendi "Geri" düğmesi: leave(() => router.back())
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<null | (() => void)>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => router.push(url.pathname + url.search + url.hash));
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, router]);

  const leave = useCallback((action: () => void) => {
    if (dirtyRef.current) setPending(() => action);
    else action();
  }, []);

  const guard = pending ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => setPending(null)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-1">Kaydedilmemiş değişiklikler var</h3>
            <p className="text-sm text-slate-600">Bu sayfadan çıkarsanız girdiğiniz bilgiler kaybolacak.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPending(null)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium" autoFocus>
            Sayfada kal
          </button>
          <button onClick={() => { const fn = pending; setPending(null); dirtyRef.current = false; fn(); }}
            className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-red-600 rounded-lg text-sm font-medium">
            Çık
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { guard, leave };
}
