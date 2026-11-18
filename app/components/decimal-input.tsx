'use client';

import { forwardRef } from 'react';

// type="number" yerine kullanılır. Telefonda ondalık klavyeyi açar (inputMode),
// Türkçe yazılan virgülü noktaya çevirir ki mevcut parseFloat hesapları aynen
// çalışsın: "12,5" → "12.5", "1.234,56" → "1234.56". Harf girilemez.
export function normalizeDecimal(raw: string): string {
  let v = raw.replace(/\s/g, '');
  if (v.includes(',')) v = v.replace(/\./g, '').replace(/,/g, '.');
  v = v.replace(/[^0-9.\-]/g, '');
  // tek eksi (başta) ve tek ondalık nokta
  const neg = v.startsWith('-');
  v = v.replace(/-/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  return (neg ? '-' : '') + v;
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { integer?: boolean };

const DecimalInput = forwardRef<HTMLInputElement, Props>(function DecimalInput({ onChange, integer, min, max, step, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      {...rest}
      onChange={e => {
        const norm = normalizeDecimal(e.target.value);
        if (norm !== e.target.value) e.target.value = norm;
        onChange?.(e);
      }}
    />
  );
});

export default DecimalInput;
