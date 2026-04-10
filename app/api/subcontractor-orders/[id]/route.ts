import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      subcontractor: { select: { id: true, name: true, email: true } },
      product: {
        include: {
          parts: {
            include: {
              material: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      materialTransfers: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      productionUpdates: { orderBy: { createdAt: 'desc' } },
      scraps: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { status, dueDate, notes, shippingAddress } = await req.json();

  const updated = await prisma.subcontractorOrder.updateMany({
    where: { id: params.id, companyId: user.companyId },
    data: {
      ...(status ? { status } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(shippingAddress !== undefined ? { shippingAddress: shippingAddress || null } : {}),
    },
  });

  if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      subcontractor: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json(order);
}
