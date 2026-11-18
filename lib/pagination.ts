import { parseDateInput, parseDateEndOfDay } from '@/lib/time';

// Liste API'leri için ortak sayfalama ve tarih filtresi.
// Vercel'de bir yanıt en fazla 4,5 MB olabildiği için büyük listeler tek seferde dönemez.

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function pageParams(searchParams: URLSearchParams, defaults: { limit?: number } = {}) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const rawLimit = parseInt(searchParams.get('limit') || '', 10);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : (defaults.limit ?? DEFAULT_PAGE_SIZE)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function pageResult<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD → Prisma tarih filtresi (İstanbul gün sınırlarıyla). */
export function dateRange(searchParams: URLSearchParams) {
  const from = parseDateInput(searchParams.get('from'));
  const to = parseDateEndOfDay(searchParams.get('to'));
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}
