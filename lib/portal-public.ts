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
  requestedDeliveryDate: true, confirmedDeliveryDate: true,
  productId: true,
  product: { select: { id: true, name: true, code: true } },
  statusHistory: { select: { id: true, status: true, note: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  shipment: { select: { shipmentDate: true, deliveryNoteNo: true, trackingNo: true, carrier: true, notes: true, items: true, totalQuantity: true } },
} as const;
