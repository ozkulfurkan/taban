export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

const PENDING_STATUSES = [
  'ORDER_RECEIVED',
  'IN_PRODUCTION',
  'MOLDING',
  'PAINTING',
  'PACKAGING',
  'READY_FOR_SHIPMENT',
] as const;

const IN_PRODUCTION_STATUSES = new Set(['IN_PRODUCTION', 'MOLDING', 'PAINTING', 'PACKAGING']);

export async function GET() {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const companyId = session.user.companyId;
    const where = session.user.role === 'ADMIN' ? {} : { companyId };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const threeDaysLater = new Date(todayStart);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const orders = await prisma.soleOrder.findMany({
      where: { ...where, status: { in: [...PENDING_STATUSES] } },
      include: {
        customer: { select: { name: true } },
        product: { select: { name: true, code: true } },
      },
      orderBy: [
        { confirmedDeliveryDate: 'asc' },
        { requestedDeliveryDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const mapped = orders.map(o => {
      const dueDate = o.confirmedDeliveryDate ?? o.requestedDeliveryDate ?? null;
      const isOverdue = !!dueDate && dueDate < todayStart;
      const isDueToday = !!dueDate && dueDate >= todayStart && dueDate < tomorrowStart;
      const isDueSoon = !!dueDate && dueDate >= tomorrowStart && dueDate < threeDaysLater;

      return {
        id: o.id,
        orderNo: o.orderNo,
        customerName: o.customer?.name ?? '—',
        productName: o.product?.name ?? o.productCode ?? '—',
        productCode: o.product?.code ?? o.productCode ?? null,
        totalQuantity: o.totalQuantity,
        dueDate: dueDate ? dueDate.toISOString() : null,
        status: o.status,
        isOverdue,
        isDueToday,
        isDueSoon,
      };
    });

    // Sort: overdue first, then today, then soon, then rest
    mapped.sort((a, b) => {
      const urgency = (o: typeof a) =>
        o.isOverdue ? 0 : o.isDueToday ? 1 : o.isDueSoon ? 2 : 3;
      return urgency(a) - urgency(b);
    });

    const stats = {
      totalPending: orders.length,
      todayDue: mapped.filter(o => o.isDueToday).length,
      overdue: mapped.filter(o => o.isOverdue).length,
      inProduction: orders.filter(o => IN_PRODUCTION_STATUSES.has(o.status)).length,
      awaitingApproval: orders.filter(o => o.status === 'ORDER_RECEIVED').length,
    };

    return NextResponse.json({
      stats,
      alerts: {
        overdueCount: stats.overdue,
        todayDueCount: stats.todayDue,
      },
      orders: mapped,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
