'use client';

import { useLayoutEffect, useRef } from 'react';

// Tek satırlık metni (genelde büyük tutarlar) kutusuna sığana kadar küçültür.
// Kesilen rakam göstermek yerine yazı boyutu düşer; tamamı title ile görünür.
// contain:inline-size uzun metnin kartı (grid hücresini) genişletmesini engeller.
export default function FitText({
  children,
  className = '',
  minPx = 11,
  as: Tag = 'p',
}: {
  children: React.ReactNode;
  className?: string;
  minPx?: number;
  as?: 'p' | 'span' | 'div';
}) {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    el.title = el.textContent ?? '';
    // Metnin gerçek genişliği iç span'den ölçülür; sığana kadar (en çok birkaç
    // adım) küçültülür. Ölçüm ile yazı boyutu her ortamda doğrusal olmayabilir.
    const clip = (on: boolean) => {
      // En küçük boyutta da sığmıyorsa sonu "…" ile kesilir (tam değer title'da)
      inner.style.maxWidth = on ? '100%' : '';
      inner.style.overflow = on ? 'hidden' : '';
      inner.style.textOverflow = on ? 'ellipsis' : '';
      inner.style.verticalAlign = on ? 'top' : '';
    };
    const fit = () => {
      clip(false);
      el.style.fontSize = '';
      const available = el.clientWidth;
      if (!available) return;
      let size = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 6; i++) {
        const needed = inner.getBoundingClientRect().width;
        if (needed <= available) break;
        const next = Math.max(minPx, Math.floor(size * (available / needed) * 100) / 100 - (i ? 0.25 : 0));
        if (next >= size) break;
        size = next;
        el.style.fontSize = `${size}px`;
      }
      if (inner.getBoundingClientRect().width > available + 0.5) clip(true);
    };
    fit();
    // Kutu genişliği değişince (ekran döndü, kenar menü açıldı) ve metin genişliği
    // değişince (web fontu sonradan yüklendi) yeniden sığdır.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null;
    ro?.observe(el);
    ro?.observe(inner);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    let alive = true;
    fonts?.ready.then(() => { if (alive) fit(); });
    fonts?.addEventListener?.('loadingdone', fit);
    return () => {
      alive = false;
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [children, minPx]);

  return (
    <Tag ref={ref as any} className={`${className} block whitespace-nowrap overflow-hidden text-ellipsis tabular-nums [contain:inline-size]`}>
      <span ref={innerRef} className="inline-block">{children}</span>
    </Tag>
  );
}
