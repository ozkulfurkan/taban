import { useAuth } from './auth';
import { useApi } from './query';

// Firma ağı: SoleCost kullanan iki firma, satıcının firma koduyla bağlanır.
// Alıcı kodu girer (istek), satıcı onaylar ve isteği bir müşteri kaydıyla eşleştirir; sonra alıcı sipariş verebilir.

export type LinkStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED';

/** Bizim alıcı olduğumuz bağlantı (tedarikçimiz SoleCost'ta) */
export type BuyerLink = {
  id: string; status: LinkStatus; createdAt: string; respondedAt: string | null; buyerSupplierId: string | null;
  sellerCompany: { name: string };
};
/** Bizim satıcı olduğumuz bağlantı (müşterimiz SoleCost'ta) */
export type SellerLink = {
  id: string; status: LinkStatus; createdAt: string; respondedAt: string | null; sellerCustomerId: string | null;
  buyerCompany: { name: string; taxId?: string | null; phone?: string | null; address?: string | null };
  sellerCustomer: { id: string; name: string } | null;
};
export type Links = { asBuyer: BuyerLink[]; asSeller: SellerLink[] };

export const LINK_STATUS: Record<LinkStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PENDING: { label: 'Onay bekliyor', tone: 'warning' },
  ACTIVE: { label: 'Bağlı', tone: 'success' },
  REJECTED: { label: 'Reddedildi', tone: 'danger' },
  REVOKED: { label: 'Kaldırıldı', tone: 'neutral' },
};

/** Tüm bağlantılar; supplierId verilirse yalnızca o tedarikçinin bağlantısı (en yenisi başta) */
export function useLinks(supplierId?: string | null, enabled = true) {
  return useApi<Links>(enabled ? '/api/network/links' : null, supplierId ? { supplierId } : undefined);
}

/** Bağlantı isteğini onaylama / reddetme ve firma kodunu yenileme yalnızca firma sahibi / yöneticide (sunucu da denetler) */
export function useIsManager() {
  const { user } = useAuth();
  return user?.type === 'staff' && (user.role === 'ADMIN' || user.role === 'COMPANY_OWNER');
}
