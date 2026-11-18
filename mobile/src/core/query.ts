import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { api } from './api';

/** GET isteği için kısa yol: anahtar = yol + sorgu parametreleri */
export function useApi<T = any>(
  path: string | null,
  query?: Record<string, string | number | undefined | null>,
  opts?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T>({
    queryKey: [path, query ?? null],
    queryFn: ({ signal }) => api<T>(path!, { query, signal }),
    enabled: !!path && (opts?.enabled ?? true),
    ...opts,
  });
}
