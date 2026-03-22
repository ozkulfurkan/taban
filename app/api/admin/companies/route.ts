export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

export async function GET() {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user || session.user.role !== 'ADMIN') return unauthorized();

    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { users: true, materials: true, soleCalculations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(companies);
  } catch (error: any) {
    console.error('GET companies error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
