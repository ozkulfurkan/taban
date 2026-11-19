import { API_URL } from './config';
import { TOKEN_KEY, getItem, setItem } from './storage';

// API istemcisi: her isteğe oturum anahtarı eklenir. 401 gelirse oturum kapatılır
// (rol değişmiş, kullanıcı silinmiş ya da süre dolmuş olabilir).
// 402 (abonelik gerekli) gelirse önce oturum anahtarı yenilenip istek bir kez tekrarlanır: abonelik yeni
// alındıysa / yenilendiyse anahtardaki bitiş tarihi eskidir. Yine 402 ise abonelik ekranına yönlendirilir.

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

// undefined: henüz yüklenmedi (açılış ya da geliştirmede modülün yeniden yüklenmesi) → güvenli depodan okunur.
// null: oturum kapalı.
let token: string | null | undefined = undefined;
let onUnauthorized: (() => void) | null = null;
let onSubscriptionRequired: ((message: string) => void) | null = null;

export function setAuthToken(t: string | null) { token = t; }
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }
export function setSubscriptionRequiredHandler(fn: ((message: string) => void) | null) { onSubscriptionRequired = fn; }

type Options = { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null>; signal?: AbortSignal };

/** Oturum anahtarını sunucudan yeniler (abonelik bilgisi güncellenir). Başarısızsa false. */
export async function refreshAuthToken(): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
      method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json() as { token?: string };
    if (!data.token) return false;
    token = data.token;
    await setItem(TOKEN_KEY, data.token);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = any>(path: string, opts: Options = {}, retried = false): Promise<T> {
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
    if (res.status === 402 && data?.code === 'SUBSCRIPTION_REQUIRED') {
      if (!retried && await refreshAuthToken()) return api<T>(path, opts, true);
      onSubscriptionRequired?.(data.error);
    }
    throw new ApiError((data && (data.error || data.message)) || `İstek başarısız (${res.status})`, res.status, data?.code);
  }
  return data as T;
}
