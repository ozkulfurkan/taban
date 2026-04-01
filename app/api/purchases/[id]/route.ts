import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true, taxId: true } },
      payments: { orderBy: { date: 'desc' } },
    },
  });

  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(purchase);
}
