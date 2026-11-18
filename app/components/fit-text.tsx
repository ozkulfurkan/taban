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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.title = el.textContent ?? '';
    const fit = () => {
      el.style.fontSize = '';
      const available = el.clientWidth;
      const needed = el.scrollWidth;
      if (!available || needed <= available) return;
      const base = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${Math.max(minPx, Math.floor(base * (available / needed) * 100) / 100)}px`;
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children, minPx]);

  return (
    <Tag ref={ref as any} className={`${className} block whitespace-nowrap overflow-hidden text-ellipsis tabular-nums [contain:inline-size]`}>
      {children}
    </Tag>
  );
}
