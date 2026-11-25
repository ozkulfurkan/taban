'use client';

import { useEffect } from 'react';

// Aynı kaydet düğmesine kısa sürede gelen ikinci tıklamayı keser (çift dokunma, yavaş cihazda iki tıklamanın
// ekran güncellenmeden işlenmesi). Kapsam: bir formu gönderen düğmeler ve data-submit işaretli kaydet düğmeleri.
// Belge düzeyinde, yakalama aşamasında çalışır; React'in olay dinleyicilerinden önce devreye girer.
// Sunucu tarafındaki koruma: lib/request-dedup.ts
export const SUBMIT_GUARD_MS = 1000;

export function SubmitGuard() {
  useEffect(() => {
    const last = new WeakMap<Element, number>();
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.('button');
      if (!btn) return;
      const b = btn as HTMLButtonElement;
      // type belirtilmemiş düğme de DOM'da "submit" sayılır: yalnızca bir formu gerçekten gönderenler korunur
      const isSubmit = (b.type === 'submit' && !!b.form) || btn.hasAttribute('data-submit');
      if (!isSubmit) return;
      const now = performance.now();
      const prev = last.get(btn);
      if (prev !== undefined && now - prev < SUBMIT_GUARD_MS) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      last.set(btn, now);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
