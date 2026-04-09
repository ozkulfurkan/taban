import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, subcontractorId: user.subcontractorId },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (order.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Sipariş tamamlanmış durumda değil' }, { status: 400 });
  }

  await prisma.productionUpdate.create({
    data: {
      orderId: params.id,
      status: 'COMPLETED',
      notes: 'Ürünler sevk edildi.',
      updatedBy: user.email,
    },
  });

  return NextResponse.json({ ok: true });
}
