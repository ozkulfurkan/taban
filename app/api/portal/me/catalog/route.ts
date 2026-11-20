export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { purchaseHistory } from '@/lib/network';
import { sortByHistory } from '@/lib/catalog-history';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user?.type !== 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: {
      companyId: user.companyId,
      portalVisible: true,
      OR: [
        { portalCustomers: { none: {} } },
        { portalCustomers: { some: { portalCustomerId: user.id } } },
      ],
    },
    select: {
      id: true, code: true, name: true, description: true, sizes: true, unit: true, imageUpdatedAt: true,
      parts: { select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  // Daha önce aldıkları üstte (satıcıdaki siparişler + faturalar)
  const history = await purchaseHistory(user.companyId, user.customerId ?? null);
  return NextResponse.json(sortByHistory(products, history));
}
