import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const stocks = await prisma.subcontractorStock.findMany({
    where: {
      subcontractorId: params.id,
      subcontractor: { companyId: user.companyId },
    },
    select: {
      materialId: true,
      quantity: true,
    },
  });

  return NextResponse.json(stocks);
}
