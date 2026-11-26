export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Sevke hazır siparişler, müşteriye göre gruplu (Sevkiyat ekranının üst bölümü)
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orders = await prisma.soleOrder.findMany({
    where: { companyId: user.companyId, status: 'READY_FOR_SHIPMENT' },
    select: { id: true, orderNo: true, totalQuantity: true, unit: true, customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 300,
  });
  const groups = new Map<string, { customer: { id: string; name: string }; orders: Array<{ id: string; orderNo: string; totalQuantity: number; unit: string | null }> }>();
  for (const o of orders) {
    const g = groups.get(o.customer.id) ?? { customer: o.customer, orders: [] };
    g.orders.push({ id: o.id, orderNo: o.orderNo, totalQuantity: o.totalQuantity, unit: o.unit });
    groups.set(o.customer.id, g);
  }
  return NextResponse.json(Array.from(groups.values()));
}
