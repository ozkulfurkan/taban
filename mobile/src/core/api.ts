import { API_URL } from './config';
import { TOKEN_KEY, getItem } from './storage';

// API istemcisi: her isteğe oturum anahtarı eklenir. 401 gelirse oturum kapatılır
// (rol değişmiş, kullanıcı silinmiş ya da süre dolmuş olabilir).

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: any) {
    super(message);
  }
}

// undefined: henüz yüklenmedi (açılış ya da geliştirmede modülün yeniden yüklenmesi) → güvenli depodan okunur.
// null: oturum kapalı.
let token: string | null | undefined = undefined;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) { token = t; }
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }
/** Kimlik gerektiren görseller için (Image source headers); oturum yoksa boş */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Options = { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null>; signal?: AbortSignal };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const q = opts.query
    ? '?' + Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  if (token === undefined) token = await getItem(TOKEN_KEY);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${q === '?' ? '' : q}`, {
      method: opts.method ?? 'GET',
      // Kimlik yalnızca Bearer token: cihazdaki çerezler (başka oturum) asla gönderilmez
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.', 0, 'NETWORK');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError((data && (data.error || data.message)) || `İstek başarısız (${res.status})`, res.status, data?.code, data);
  }
  return data as T;
}
