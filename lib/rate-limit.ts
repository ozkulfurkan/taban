type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

// Periodically clean up expired entries to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    store.forEach((v, k) => { if (now > v.resetAt) store.delete(k); });
  }, 60_000);
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= options.limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { ok: true, retryAfter: 0 };
}

export function getRateLimitKey(req: Request, prefix: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return `${prefix}:${ip}`;
}
