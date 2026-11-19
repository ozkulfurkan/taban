// Firma aboneliği kuralları. Saf modül: middleware (edge), sunucu, web ve mobil (@shared/subscription) aynı kuralı kullanır.
//
// - PRO: proUntil boşsa süresiz (abonelik sistemi öncesi firmalar "LEGACY" ve elle verilen süresiz PRO), doluysa o tarihe kadar
// - TRIAL: trialEndsAt'e kadar (yeni firmalara kayıtta TRIAL_DAYS gün)
// - Süre dolunca firma salt okunur: okuma serbest, yazma (POST/PUT/PATCH/DELETE) abonelik gerektirir

export const TRIAL_DAYS = 30;

/** RevenueCat'te abonelik yetkisinin (entitlement) kimliği */
export const ENTITLEMENT_ID = 'pro';

export type SubscriptionFields = {
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
  proUntil?: Date | string | null;
  subscriptionSource?: string | null;
  subscriptionPlan?: string | null;
};

export type SubscriptionKind = 'lifetime' | 'pro' | 'trial' | 'expired';

export type SubscriptionState = {
  active: boolean;
  kind: SubscriptionKind;
  /** Bitiş (süresizde null) */
  until: string | null;
  /** Kalan tam gün (süresizde null, dolmuşsa 0) */
  daysLeft: number | null;
  plan: string | null;
  source: string | null;
};

const time = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() : null);

export function subscriptionState(c: SubscriptionFields, now: Date = new Date()): SubscriptionState {
  const n = now.getTime();
  const base = { plan: c.subscriptionPlan ?? null, source: c.subscriptionSource ?? null };
  const left = (t: number) => Math.max(0, Math.ceil((t - n) / 86_400_000));

  if (c.subscriptionStatus === 'PRO') {
    const until = time(c.proUntil);
    if (until === null) return { ...base, active: true, kind: 'lifetime', until: null, daysLeft: null };
    if (until > n) return { ...base, active: true, kind: 'pro', until: new Date(until).toISOString(), daysLeft: left(until) };
    // Abonelik dolmuş; deneme hâlâ sürüyorsa (ör. denemede abone olup iptal) deneme geçerli
  }
  const trial = time(c.trialEndsAt);
  if (c.subscriptionStatus === 'TRIAL' || c.subscriptionStatus === 'PRO') {
    if (trial !== null && trial > n) return { ...base, active: true, kind: 'trial', until: new Date(trial).toISOString(), daysLeft: left(trial) };
  }
  const last = Math.max(time(c.proUntil) ?? 0, trial ?? 0);
  return { ...base, active: false, kind: 'expired', until: last ? new Date(last).toISOString() : null, daysLeft: 0 };
}

/** Oturum token'ına yazılan özet: abonelik bitişi (ms), süresizse null. Middleware veritabanına gitmeden karar verir. */
export function subscriptionUntilMs(c: SubscriptionFields): number | null {
  const s = subscriptionState(c, new Date(0)); // zamandan bağımsız: en geç geçerlilik anı
  if (s.kind === 'lifetime') return null;
  const pro = c.subscriptionStatus === 'PRO' ? time(c.proUntil) : null;
  const trial = c.subscriptionStatus === 'TRIAL' || c.subscriptionStatus === 'PRO' ? time(c.trialEndsAt) : null;
  return Math.max(pro ?? 0, trial ?? 0);
}

/** Token'daki özetle şu an yazma yapılabilir mi (null = süresiz) */
export const tokenSubscriptionActive = (subUntil: number | null | undefined, now = Date.now()) =>
  subUntil === undefined || subUntil === null || subUntil > now;

/** Ürün kimliğinden plan: ...yearly / ...annual → YEARLY, diğerleri MONTHLY */
export const planOfProduct = (productId?: string | null) =>
  !productId ? null : /year|annual|yillik/i.test(productId) ? 'YEARLY' : 'MONTHLY';
