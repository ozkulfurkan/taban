export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

export async function GET() {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const companyId = session.user.companyId;
    const where = session.user.role === 'ADMIN' ? {} : { companyId };

    const [materialCount, calcCount, recentCalcs] = await Promise.all([
      prisma.material.count({ where }),
      prisma.soleCalculation.count({ where }),
      prisma.soleCalculation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
    ]);

    const calcs = await prisma.soleCalculation.findMany({ where, select: { totalCost: true } });
    const avgCost = calcs?.length ? (calcs.reduce((s: number, c: any) => s + (c?.totalCost ?? 0), 0) / calcs.length) : 0;

    return NextResponse.json({ materialCount, calcCount, avgCost, recentCalcs });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
