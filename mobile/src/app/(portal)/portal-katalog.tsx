import { OrderCatalog } from '@/components/order-catalog';

// Portal müşterisinin katalogu ve sepeti
export default function Katalog() {
  return (
    <OrderCatalog
      catalogUrl="/api/portal/me/catalog"
      orderUrl="/api/portal/me/orders"
      ordersKey="/api/portal/me/orders"
      detailHref={id => `/siparisler/${id}`}
    />
  );
}
