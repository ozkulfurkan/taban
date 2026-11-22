'use client';

import { ChevronLeft, ChevronRight } from '@/app/components/icons';

// Liste sayfalarının altındaki sayfa geçişi.
export function Pager({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const btn = 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-ink-200 bg-white text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-40 disabled:hover:bg-white';
  return (
    <nav aria-label="Sayfalar" className="flex items-center justify-between gap-3 flex-wrap text-sm text-ink-500">
      <span>{total.toLocaleString('tr-TR')} kayıt · Sayfa {page} / {totalPages}</span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" /> Önceki
        </button>
        <button className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Sonraki <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
