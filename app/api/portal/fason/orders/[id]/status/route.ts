import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  MATERIAL_SENT: ['IN_PRODUCTION'],
  IN_PRODUCTION: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status, completedPairs, notes } = await req.json();
  if (!status) return NextResponse.json({ error: 'Durum gerekli' }, { status: 400 });

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, subcontractorId: user.subcontractorId, companyId: user.companyId },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `${order.status} durumundan ${status} durumuna geçiş yapılamaz` }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.subcontractorOrder.update({
      where: { id: params.id },
      data: { status },
    }),
    prisma.productionUpdate.create({
      data: {
        orderId: params.id,
        status,
        completedPairs: completedPairs ? parseInt(completedPairs) : null,
        notes: notes || null,
        updatedBy: user.email,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
