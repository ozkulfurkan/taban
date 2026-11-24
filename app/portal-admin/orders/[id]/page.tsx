import { redirect } from 'next/navigation';

// Portal siparişleri de firma sipariş detayında yönetilir (kısmi sevkiyat, mesajlar, talepler, durum kuralları tek yerde)
export default function PortalAdminOrderRedirect({ params }: { params: { id: string } }) {
  redirect(`/orders/${encodeURIComponent(params.id)}`);
}
