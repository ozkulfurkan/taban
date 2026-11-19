import { useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import type { SubscriptionState } from '@shared/subscription';
import { api, refreshAuthToken } from './api';
import { useApi } from './query';

// Firma aboneliği (iPhone). Satın alma Apple ile, doğrulama RevenueCat ile yapılır;
// RevenueCat kullanıcı kimliği = firma id'si (abonelik firma başına). Sunucu tek doğru kaynaktır:
// satın almadan sonra /api/subscription/sync ile firma güncellenir ve oturum anahtarı yenilenir.

export type SubscriptionInfo = SubscriptionState & { companyId: string; trialDays: number; canPurchase: boolean };

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
/** Satın alma yalnızca iOS'ta ve RevenueCat anahtarı tanımlıysa (Expo Go'da RevenueCat önizleme modunda çalışır) */
export const purchasesAvailable = Platform.OS === 'ios' && !!IOS_KEY;

export const useSubscription = () => useApi<SubscriptionInfo>('/api/subscription');

let configuredFor: string | null = null;

/** RevenueCat'i firmaya bağlar (ilk çağrıda yapılandırır, firma değiştiyse oturumu değiştirir) */
async function ensure(companyId: string) {
  if (!purchasesAvailable) throw new Error('Satın alma bu cihazda kullanılamıyor');
  if (configuredFor === null) {
    Purchases.configure({ apiKey: IOS_KEY!, appUserID: companyId });
    configuredFor = companyId;
  } else if (configuredFor !== companyId) {
    await Purchases.logIn(companyId);
    configuredFor = companyId;
  }
}

/** Satışta olan paketler: aylık ve yıllık (RevenueCat "current" offering) */
export async function loadPackages(companyId: string): Promise<PurchasesPackage[]> {
  await ensure(companyId);
  const current = (await Purchases.getOfferings()).current;
  if (!current) return [];
  const known = [current.monthly, current.annual].filter((p): p is PurchasesPackage => !!p);
  return known.length ? known : current.availablePackages;
}

/** Kullanıcı vazgeçtiyse true döner (hata gösterilmez) */
export const isCancelled = (e: any) => !!e?.userCancelled;

/** Satın alma / geri yükleme sonrası sunucuyu eşitle, oturum anahtarını yenile, ekranları tazele */
export function useAfterPurchase() {
  const qc = useQueryClient();
  return async () => {
    await api('/api/subscription/sync', { method: 'POST' }).catch(() => null); // webhook da aynı işi yapar
    await refreshAuthToken();
    await qc.invalidateQueries();
  };
}

export async function purchase(companyId: string, pkg: PurchasesPackage) {
  await ensure(companyId);
  await Purchases.purchasePackage(pkg);
}

export async function restore(companyId: string) {
  await ensure(companyId);
  await Purchases.restorePurchases();
}

/** "Deneme: 12 gün kaldı", "Aylık abonelik · 21.12.2026'ya kadar" ... */
export function subscriptionSummary(s: SubscriptionState, formatDate: (v: string) => string): string {
  switch (s.kind) {
    case 'lifetime': return 'Süresiz kullanım';
    case 'trial': return `Ücretsiz deneme · ${s.daysLeft} gün kaldı`;
    case 'pro': return `${s.plan === 'YEARLY' ? 'Yıllık' : 'Aylık'} abonelik · ${s.until ? `${formatDate(s.until)} tarihine kadar` : ''}`;
    default: return 'Abonelik süresi doldu · salt okunur';
  }
}
