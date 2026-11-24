import { SHIPMENT_ORDER, SHIPMENT_PUBLIC_SELECT, withLastShipment } from '@/lib/order-shipments';
// Portal hesabının personele dönen alanları: şifre hash'i ve e-posta doğrulama token'ı asla dönmez.
export const PORTAL_CUSTOMER_PUBLIC = {
  id: true, customerId: true, portalType: true, email: true, name: true,
  emailVerified: true, isActive: true, createdAt: true, updatedAt: true,
} as const;

/** Portal müşterisinin görebildiği ve sipariş edebildiği ürünler (katalog ve sipariş aynı kuralı kullanır) */
export function portalCatalogWhere(user: { id: string; companyId: string }) {
  return {
    companyId: user.companyId,
    portalVisible: true,
    OR: [
      { portalCustomers: { none: {} } },
      { portalCustomers: { some: { portalCustomerId: user.id } } },
    ],
  };
}

/** Portal müşterisine dönen sipariş alanları: satıcının iç alanları (fatura, parça hammadde seçimi, firma kimlikleri) dönmez */
export const PORTAL_ORDER_SELECT = {
  id: true, orderNo: true, status: true, createdAt: true, totalQuantity: true, unit: true,
  productCode: true, color: true, material: true, notes: true,
  sizeDistribution: true, orderItems: true, colorPartials: true,
  requestedDeliveryDate: true, confirmedDeliveryDate: true, confirmedAt: true,
  productId: true,
  product: { select: { id: true, name: true, code: true } },
  statusHistory: { select: { id: true, status: true, note: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  shipments: { select: SHIPMENT_PUBLIC_SELECT, orderBy: SHIPMENT_ORDER },
  // Yalnızca kaynağı ("Portaldan" / "Firma tarafından") ve okunmamış mesajı hesaplamak için; yanıtta dönmez
  portalCustomerId: true, linkId: true,
  _count: { select: { messages: { where: { authorType: 'staff', readByCustomerAt: null } } } },
} as const;

/** Müşteriye dönen sipariş: son sevkiyat, kaynak ve okunmamış mesaj sayısı; iç kimlikler çıkarılır */
export function toPortalOrder(o: any) {
  const { portalCustomerId, linkId, _count, ...rest } = o;
  return { ...withLastShipment(rest), source: portalCustomerId ? 'portal' : linkId ? 'network' : 'firm', unreadMessages: _count?.messages ?? 0 };
}

/** Portal müşterisinin siparişleri: müşterinin tüm siparişleri (firmanın onun adına açtıkları dahil) */
export const portalOrdersWhere = (user: { companyId: string; customerId: string }) => ({ companyId: user.companyId, customerId: user.customerId });
