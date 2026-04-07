export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

async function getSession(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user?.type === 'portal') return null;
  return user;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const product = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: {
      portalVisible: true,
      portalCustomers: { select: { portalCustomerId: true } },
    },
  });

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    portalVisible: product.portalVisible,
    assignedCustomerIds: product.portalCustomers.map(pc => pc.portalCustomerId),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { portalVisible, assignedCustomerIds } = body as {
    portalVisible: boolean;
    assignedCustomerIds: string[];
  };

  // Verify product belongs to company
  const product = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    // Update portalVisible flag
    prisma.product.update({
      where: { id: params.id },
      data: { portalVisible },
    }),
    // Replace all customer assignments
    prisma.productPortalCustomer.deleteMany({ where: { productId: params.id } }),
    ...(portalVisible && assignedCustomerIds?.length > 0
      ? [prisma.productPortalCustomer.createMany({
          data: assignedCustomerIds.map(portalCustomerId => ({
            productId: params.id,
            portalCustomerId,
          })),
          skipDuplicates: true,
        })]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
