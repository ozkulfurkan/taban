import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { subcontractorId, productId, sizeDistribution, dueDate, notes, shippingAddress } = await req.json();

  if (!subcontractorId) return NextResponse.json({ error: 'Fasoncu seçilmedi' }, { status: 400 });
  if (!sizeDistribution || typeof sizeDistribution !== 'object') {
    return NextResponse.json({ error: 'Numara dağılımı gerekli' }, { status: 400 });
  }

  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, companyId: user.companyId },
  });
  if (!subcontractor) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });

  const totalPairs = Object.values(sizeDistribution as Record<string, number>).reduce(
    (sum: number, v) => sum + (Number(v) || 0),
    0
  );

  // Auto-generate orderNo: FAS-YYYY-NNN
  const year = new Date().getFullYear();
  const last = await prisma.subcontractorOrder.findFirst({
    where: { companyId: user.companyId, orderNo: { startsWith: `FAS-${year}-` } },
    orderBy: { orderNo: 'desc' },
  });
  const seq = last ? parseInt(last.orderNo.split('-')[2]) + 1 : 1;
  const orderNo = `FAS-${year}-${String(seq).padStart(3, '0')}`;

  const order = await prisma.subcontractorOrder.create({
    data: {
      companyId: user.companyId,
      orderNo,
      subcontractorId,
      productId: productId || null,
      sizeDistribution,
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
