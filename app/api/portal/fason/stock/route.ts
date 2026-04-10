import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stocks = await prisma.subcontractorStock.findMany({
    where: { subcontractorId: user.subcontractorId },
    include: {
      material: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(stocks);
}
