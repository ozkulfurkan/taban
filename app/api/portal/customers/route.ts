export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PORTAL_CUSTOMER_PUBLIC } from '@/lib/portal-public';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const portalCustomers = await prisma.portalCustomer.findMany({
    where: { customer: { companyId: user.companyId } },
    select: { ...PORTAL_CUSTOMER_PUBLIC, customer: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(portalCustomers);
}
