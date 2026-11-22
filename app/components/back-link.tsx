'use client';

import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';

// "Geri" yerine sabit bir üst sayfaya giden bağlantı. Tarayıcı geçmişine
// bakmadığı için kaydet/düzenle döngüsüne girmez; etiket nereye gideceğini söyler.
// Bir <a> olduğundan kaydedilmemiş değişiklik uyarısı (useLeaveGuard) bunu da yakalar.
export default function BackLink({
  href, label, prefix, variant = 'text', className = '',
}: {
  href: string;
  label?: string;
  prefix?: string;
  variant?: 'text' | 'button' | 'icon';
  className?: string;
}) {
  const text = prefix && label ? `${prefix}: ${label}` : label ?? prefix ?? '';
  const aria = `${text || 'Önceki'} sayfasına dön`;
  if (variant === 'icon') {
    return (
      <Link href={href} aria-label={aria} title={aria} className={`p-1.5 rounded-lg hover:bg-ink-200 transition-colors flex-shrink-0 ${className}`}>
        <ArrowLeft className="w-5 h-5 text-ink-600" />
      </Link>
    );
  }
  const look = variant === 'button'
    ? 'px-3 py-2 bg-white border border-ink-200 hover:bg-ink-50 text-ink-700 rounded-lg font-medium'
    : 'text-ink-500 hover:text-ink-700';
  return (
    <Link href={href} title={aria} aria-label={aria} className={`inline-flex items-center gap-1.5 text-sm transition-colors min-w-0 max-w-full ${look} ${className}`}>
      <ArrowLeft className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{text}</span>
    </Link>
  );
}
