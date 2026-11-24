import { NextRequest, NextResponse } from 'next/server';
import { SHIP_NOTE, cleanSizeDistribution } from '@/lib/fason';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rejectForeignRefs } from '@/lib/tenant';
import { nextDocumentNumber, documentYear } from '@/lib/doc-number';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const subcontractorId = searchParams.get('subcontractorId');
  const status = searchParams.get('status');

  const orders = await prisma.subcontractorOrder.findMany({
    where: {
      companyId: user.companyId,
      ...(subcontractorId ? { subcontractorId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      subcontractor: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, code: true } },
      // Son bildirilen üretilen adet (liste ilerleme çubuğu)
      productionUpdates: { where: { completedPairs: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { completedPairs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const shipped = new Set((await prisma.productionUpdate.findMany({
    where: { orderId: { in: orders.map(o => o.id) }, notes: SHIP_NOTE }, select: { orderId: true },
  })).map(u => u.orderId));

  return NextResponse.json(orders.map(({ productionUpdates, ...o }) => ({
    ...o, completedPairs: productionUpdates[0]?.completedPairs ?? null, shipped: shipped.has(o.id),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { subcontractorId, productId, soleOrderId, sizeDistribution, dueDate, notes, shippingAddress } = await req.json();
  const foreign = await rejectForeignRefs(user.companyId, { subcontractor: subcontractorId, product: productId, soleOrder: soleOrderId });
  if (foreign) return foreign;

  if (!subcontractorId) return NextResponse.json({ error: 'Fasoncu seçilmedi' }, { status: 400 });
  const dist = cleanSizeDistribution(sizeDistribution);
  if ('error' in dist) return NextResponse.json({ error: dist.error }, { status: 400 });

  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, companyId: user.companyId },
  });
  if (!subcontractor) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });

  const totalPairs = dist.total;

  // Auto-generate orderNo: FAS-YYYY-NNN
  const orderNo = await nextDocumentNumber('subcontractorOrder', user.companyId, `FAS-${documentYear()}-`, { pad: 3 });

  const order = await prisma.subcontractorOrder.create({
    data: {
      companyId: user.companyId,
      orderNo,
      subcontractorId,
      productId: productId || null,
      soleOrderId: soleOrderId || null,
      sizeDistribution: dist.sizes,
      totalPairs,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      shippingAddress: shippingAddress || null,
    },
    include: {
      subcontractor: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json(order, { status: 201 });
}
