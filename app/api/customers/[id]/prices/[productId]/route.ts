import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: { id: string; productId: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.customerProductPrice.deleteMany({
    where: { customerId: params.id, productId: params.productId, companyId: user.companyId },
  });

  return NextResponse.json({ ok: true });
}
