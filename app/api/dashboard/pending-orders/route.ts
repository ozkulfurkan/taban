export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthSession, unauthorized } from '@/lib/helpers';
import { pendingOrders } from '@/lib/daily-summary';

const IN_PRODUCTION_STATUSES = new Set(['IN_PRODUCTION', 'MOLDING', 'PAINTING', 'PACKAGING']);

export async function GET() {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const companyId = session.user.companyId;
    if (!companyId) return unauthorized();

    const orders = await pendingOrders(companyId);
    const mapped = orders.map(o => ({
      id: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      productName: o.productName,
      productCode: o.productCode,
      totalQuantity: o.totalQuantity,
      unit: o.unit,
      dueDate: o.dueDate ? o.dueDate.toISOString() : null,
      status: o.status,
      confirmedAt: o.confirmedAt ? o.confirmedAt.toISOString() : null,
      isOverdue: o.isOverdue,
      isDueToday: o.isDueToday,
      isDueSoon: o.isDueSoon,
    }));

    const stats = {
      totalPending: orders.length,
      todayDue: mapped.filter(o => o.isDueToday).length,
      overdue: mapped.filter(o => o.isOverdue).length,
      inProduction: orders.filter(o => IN_PRODUCTION_STATUSES.has(o.status)).length,
      awaitingApproval: orders.filter(o => o.status === 'ORDER_RECEIVED' && !o.confirmedAt).length,
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
