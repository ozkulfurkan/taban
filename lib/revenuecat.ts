import { prisma } from '@/lib/prisma';
import { ENTITLEMENT_ID, planOfProduct, subscriptionState } from '@/lib/subscription';

// iPhone aboneliği (Apple → RevenueCat). RevenueCat'te kullanıcı kimliği = firma id'si (app_user_id),
// abonelik firma başınadır. Güncel durum her zaman RevenueCat REST API'sinden okunur (webhook da, "eşitle" de aynı yol).
// Ortam: REVENUECAT_SECRET_KEY (sk_...), REVENUECAT_WEBHOOK_AUTH (webhook Authorization başlığı)

const API = 'https://api.revenuecat.com/v1';

const COMPANY_SUB = { id: true, subscriptionStatus: true, trialEndsAt: true, proUntil: true, subscriptionSource: true, subscriptionPlan: true } as const;

type Entitlement = { expires_date?: string | null; grace_period_expires_date?: string | null; product_identifier?: string | null };

export const revenueCatConfigured = () => !!process.env.REVENUECAT_SECRET_KEY;

async function fetchEntitlement(appUserId: string): Promise<Entitlement | null> {
  const res = await fetch(`${API}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  const json = await res.json() as { subscriber?: { entitlements?: Record<string, Entitlement> } };
  return json.subscriber?.entitlements?.[ENTITLEMENT_ID] ?? null;
}

/**
 * Firmanın aboneliğini RevenueCat'teki duruma getirir ve güncel durumu döner.
 * - Abonelik öncesi firmalar (LEGACY) süresizdir; dokunulmaz.
 * - Elle verilen (MANUAL) süre RevenueCat'ten daha geçse kısaltılmaz.
 * - Abonelik dolmuşsa kayıt kalır (bitiş geçmişte), firma salt okunura düşer.
 */
export async function syncCompanyFromRevenueCat(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: COMPANY_SUB });
  if (!company) return null;
  if (company.subscriptionSource === 'LEGACY' || !revenueCatConfigured()) return subscriptionState(company);

  const ent = await fetchEntitlement(companyId);
  if (!ent) return subscriptionState(company);

  const rcUntil = ent.grace_period_expires_date ?? ent.expires_date ?? null; // null: süresiz (abonelik dışı satın alma)
  const keepManual = company.subscriptionSource === 'MANUAL' && company.proUntil
    && (!rcUntil || company.proUntil.getTime() > new Date(rcUntil).getTime());
  if (keepManual) return subscriptionState(company);

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionStatus: 'PRO',
      proUntil: rcUntil ? new Date(rcUntil) : null,
      subscriptionPlan: planOfProduct(ent.product_identifier),
      subscriptionSource: 'APPLE',
    },
    select: COMPANY_SUB,
  });
  return subscriptionState(updated);
}

/** Webhook olayındaki olası kullanıcı kimlikleri (firma id'si olanlar senkronlanır) */
export function webhookAppUserIds(event: any): string[] {
  const ids = [event?.app_user_id, event?.original_app_user_id, ...(Array.isArray(event?.aliases) ? event.aliases : []),
    ...(Array.isArray(event?.transferred_to) ? event.transferred_to : []), ...(Array.isArray(event?.transferred_from) ? event.transferred_from : [])];
  // RevenueCat anonim kimlikleri ($RCAnonymousID:...) firma değildir
  return Array.from(new Set(ids.filter((x): x is string => typeof x === 'string' && !!x && !x.startsWith('$RCAnonymousID'))));
}
