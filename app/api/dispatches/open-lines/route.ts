export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { openLines } from '@/lib/dispatch';
import { canPrice, resolvePrices } from '@/lib/dispatch-prices';

// Müşterinin açık siparişlerinin kalan kalemleri + (yetkiliye) kayıtlı fiyatlar; ?productIds= ile ek ürün fiyatları
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const customerId = req.nextUrl.searchParams.get('customerId');
  if (!customerId) return NextResponse.json({ error: 'Müşteri seçin' }, { status: 400 });
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: user.companyId }, select: { id: true, name: true, currency: true } });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const extra = (req.nextUrl.searchParams.get('productIds') ?? '').split(',').filter(Boolean).slice(0, 100);
  const [orders, prices] = await Promise.all([
    openLines(user, customerId),
    canPrice(user) && extra.length ? resolvePrices(user.companyId, customerId, extra) : Promise.resolve({}),
  ]);
  return NextResponse.json({ customer, orders, prices, canPrice: canPrice(user) });
}
