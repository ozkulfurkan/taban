export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { portalOrdersWhere } from '@/lib/portal-public';
import { deliveryNoteData } from '@/lib/delivery-note-data';

// Müşteri: siparişinin bir sevkiyatının irsaliye verisi (?shipment=… yoksa son sevkiyat)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || !user?.customerId || !user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await deliveryNoteData({ id: params.id, ...portalOrdersWhere(user) }, req.nextUrl.searchParams.get('shipment'));
  return data ? NextResponse.json(data) : NextResponse.json({ error: 'Sevkiyat bulunamadı' }, { status: 404 });
}
